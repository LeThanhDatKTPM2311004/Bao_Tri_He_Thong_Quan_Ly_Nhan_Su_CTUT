import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { execFile, execFileSync } from 'child_process';
import libre from 'libreoffice-convert';

const execFileAsync = promisify(execFile);

const WINDOWS_SOFFICE_DIRS = [
  'C:\\Program Files\\LibreOffice\\program',
  'C:\\Program Files (x86)\\LibreOffice\\program',
];

const LINUX_SOFFICE_CANDIDATES = [
  '/usr/bin/soffice',
  '/usr/lib/libreoffice/program/soffice',
  '/usr/bin/libreoffice',
];

/** @type {string | null | undefined} */
let cachedSofficeCommand;

const looksLikeBinary = (value) => {
  const text = String(value || '').trim();
  if (!text || !fs.existsSync(text)) return false;
  if (process.platform === 'win32') {
    const lower = text.toLowerCase();
    return lower.endsWith('.com') || lower.endsWith('.exe');
  }
  return true;
};

/** Windows: ưu tiên soffice.com (console) — soffice.exe dễ treo khi gọi headless. */
const windowsBinariesIn = (dir) => {
  if (!dir) return [];
  return [path.join(dir, 'soffice.com'), path.join(dir, 'soffice.exe')];
};

const collectCandidates = () => {
  const list = [];
  if (process.env.SOFFICE_PATH) list.push(process.env.SOFFICE_PATH);

  if (process.platform === 'win32') {
    for (const dir of WINDOWS_SOFFICE_DIRS) {
      list.push(...windowsBinariesIn(dir));
    }
    try {
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      for (const root of [programFiles, programFilesX86]) {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || !/libreoffice/i.test(entry.name)) continue;
          list.push(...windowsBinariesIn(path.join(root, entry.name, 'program')));
        }
      }
    } catch {
      // ignore
    }
  } else {
    list.push(...LINUX_SOFFICE_CANDIDATES);
  }

  return [...new Set(list.filter(Boolean))];
};

const resolveFromPath = () => {
  const names = process.platform === 'win32' ? ['soffice.com', 'soffice.exe', 'soffice'] : ['soffice'];
  const finder = process.platform === 'win32' ? 'where' : 'which';
  for (const name of names) {
    try {
      const out = execFileSync(finder, [name], {
        timeout: 2500,
        encoding: 'utf8',
        windowsHide: true,
      });
      const first = String(out)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      if (first && looksLikeBinary(first)) return first;
    } catch {
      // try next name
    }
  }
  return null;
};

/**
 * Chỉ trả về binary thật sự có trên máy.
 * Windows dùng soffice.com nếu có — CLI ổn định hơn soffice.exe.
 */
export const getSofficeCommand = () => {
  if (cachedSofficeCommand !== undefined) return cachedSofficeCommand;

  for (const candidate of collectCandidates()) {
    if (looksLikeBinary(candidate)) {
      cachedSofficeCommand = candidate;
      return cachedSofficeCommand;
    }
  }

  cachedSofficeCommand = resolveFromPath();
  return cachedSofficeCommand;
};

export const isLibreOfficeAvailable = () => Boolean(getSofficeCommand());

/** Hàng đợi tuần tự — tránh nhiều soffice song song treo free tier. */
let convertChain = Promise.resolve();

const enqueue = (task) => {
  const run = convertChain.then(task, task);
  convertChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const runSofficeConvert = async (docxPaths, outDir) => {
  const command = getSofficeCommand();
  if (!command) {
    throw new Error('LibreOffice (soffice) chưa được cài');
  }

  const inputs = (Array.isArray(docxPaths) ? docxPaths : [docxPaths]).filter(Boolean);
  if (!inputs.length) return;

  await execFileAsync(
    command,
    [
      '--headless',
      '--nologo',
      '--nofirststartwizard',
      '--norestore',
      '--convert-to',
      'pdf:writer_pdf_Export',
      '--outdir',
      outDir,
      ...inputs,
    ],
    {
      env: {
        ...process.env,
        HOME: process.env.HOME || '/tmp',
        FONTCONFIG_PATH: process.env.FONTCONFIG_PATH || '/etc/fonts',
        SAL_USE_VCLPLUGIN: 'svp',
        SAL_NO_QUERY_TO_DESKTOP: '1',
      },
      timeout: Math.max(45000, inputs.length * 12000),
      maxBuffer: 40 * 1024 * 1024,
      windowsHide: true,
    },
  );
};

const runLibreConvert = (docxBuffer) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('libre.convert timeout')), 12000);
    libre.convert(docxBuffer, '.pdf', undefined, (error, done) => {
      clearTimeout(timer);
      if (error) return reject(error);
      return resolve(done);
    });
  });

const readPdfIfExists = async (docxPath, outDir) => {
  const base = path.basename(docxPath, path.extname(docxPath));
  const pdfPath = path.join(outDir, `${base}.pdf`);
  if (!fs.existsSync(pdfPath)) return null;
  return fs.promises.readFile(pdfPath);
};

/**
 * Convert DOCX → PDF (soffice ưu tiên, fallback libreoffice-convert).
 * Trả về buffer PDF hoặc null nếu thất bại / chưa cài LibreOffice.
 */
export const convertDocxToPdfBuffer = (docxPath, outDir, normalizedDocxBuffer) => {
  if (!getSofficeCommand()) return Promise.resolve(null);

  return enqueue(async () => {
    try {
      await runSofficeConvert([docxPath], outDir);
      const pdf = await readPdfIfExists(docxPath, outDir);
      if (pdf) return pdf;
    } catch {
      // fallback below
    }

    try {
      const pdfBuffer = await runLibreConvert(normalizedDocxBuffer);
      const base = path.basename(docxPath, path.extname(docxPath));
      const pdfPath = path.join(outDir, `${base}.pdf`);
      await fs.promises.writeFile(pdfPath, pdfBuffer);
      return Buffer.from(pdfBuffer);
    } catch {
      return null;
    }
  });
};

/**
 * Convert nhiều DOCX trong ít lần gọi soffice (nhanh hơn nhiều so với từng file).
 * @returns {Promise<Map<string, Buffer>>} key = docxPath tuyệt đối
 */
export const convertDocxBatchToPdfBuffers = (docxPaths, outDir, chunkSize = 12) => {
  if (!getSofficeCommand()) return Promise.resolve(new Map());

  return enqueue(async () => {
    const paths = (docxPaths || []).filter(Boolean);
    /** @type {Map<string, Buffer>} */
    const result = new Map();
    if (!paths.length) return result;

    const size = Math.max(1, Number(chunkSize) || 12);
    for (let i = 0; i < paths.length; i += size) {
      const chunk = paths.slice(i, i + size);
      try {
        await runSofficeConvert(chunk, outDir);
      } catch {
        // batch fail — thử từng file, không chờ timeout dài
      }

      for (const docxPath of chunk) {
        try {
          const pdf = await readPdfIfExists(docxPath, outDir);
          if (pdf) {
            result.set(path.resolve(docxPath), pdf);
            continue;
          }
        } catch {
          // fall through
        }
        try {
          const docxBuf = await fs.promises.readFile(docxPath);
          const pdfBuffer = await runLibreConvert(docxBuf);
          const base = path.basename(docxPath, path.extname(docxPath));
          const pdfPath = path.join(outDir, `${base}.pdf`);
          await fs.promises.writeFile(pdfPath, pdfBuffer);
          result.set(path.resolve(docxPath), Buffer.from(pdfBuffer));
        } catch {
          // keep missing — caller dùng DOCX
        }
      }
    }

    return result;
  });
};

/** Convert buffer DOCX → PDF (dùng khi xem/ký hồ sơ chưa kịp chuyển). */
export const convertDocxBufferToPdf = async (docxBuffer) => {
  if (!getSofficeCommand() || !docxBuffer?.length) return null;
  const tempDir = path.join(
    process.cwd(),
    'temp',
    `pdf_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
  );
  await fs.promises.mkdir(tempDir, { recursive: true });
  const docxPath = path.join(tempDir, 'source.docx');
  try {
    await fs.promises.writeFile(docxPath, docxBuffer);
    return await convertDocxToPdfBuffer(docxPath, tempDir, docxBuffer);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

/** Làm ấm soffice sau khi server listen (không chặn startup / không enqueue nếu thiếu). */
export const warmLibreOffice = () => {
  const command = getSofficeCommand();
  if (!command) {
    console.warn('[LibreOffice] Bỏ qua: chưa tìm thấy soffice trên máy này');
    return;
  }
  console.log('[LibreOffice] Dùng:', command);
  setTimeout(() => {
    enqueue(async () => {
      try {
        await execFileAsync(command, ['--version'], {
          env: {
            ...process.env,
            HOME: process.env.HOME || '/tmp',
            SAL_USE_VCLPLUGIN: 'svp',
            SAL_NO_QUERY_TO_DESKTOP: '1',
          },
          timeout: 8000,
          windowsHide: true,
        });
        console.log('[LibreOffice] Warmed (--version ok)');
      } catch (err) {
        cachedSofficeCommand = null;
        console.warn('[LibreOffice] Warm skipped:', err.message);
      }
    });
  }, 1500);
};
