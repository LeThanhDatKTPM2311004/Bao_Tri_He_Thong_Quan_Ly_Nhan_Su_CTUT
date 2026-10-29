import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button, Space, Spin, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { workflowsApi } from '../services/workflowsApi';
import type { SignaturePlacement } from '../types/workflows.types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const CANVAS_WIDTH = 460;

interface BoxRatios {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_BOX: BoxRatios = { x: 0.55, y: 0.68, w: 0.36, h: 0.18 };

interface SignaturePlacerProps {
  fileUrl?: string;
  /** Ảnh chữ ký để hiển thị preview trong khung */
  signatureImageUrl?: string;
  /** Họ tên người ký — preview dòng "Ký bởi" */
  signerName?: string;
  /** Nhãn hiển thị phía trên khung (chỉ UI chọn vị trí) */
  boxLabel?: string;
  onChange: (placement: SignaturePlacement) => void;
}

type DragMode = 'move' | 'resize' | null;

export function SignaturePlacer({
  fileUrl,
  signatureImageUrl,
  signerName = '',
  boxLabel = 'CHỮ KÝ',
  onChange,
}: SignaturePlacerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [display, setDisplay] = useState({ w: CANVAS_WIDTH, h: 0 });
  const [box, setBox] = useState<BoxRatios>(DEFAULT_BOX);
  const [imageBroken, setImageBroken] = useState(false);

  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startBox: BoxRatios;
    rectW: number;
    rectH: number;
  } | null>(null);

  useEffect(() => {
    onChange({
      page: pageNum,
      xRatio: box.x,
      yRatio: box.y,
      widthRatio: box.w,
      heightRatio: box.h,
    });
  }, [box, pageNum, onChange]);

  useEffect(() => {
    setImageBroken(false);
  }, [signatureImageUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!fileUrl) {
      setError('Không có file để hiển thị');
      return;
    }
    setLoading(true);
    setError('');
    (async () => {
      try {
        const blob = await workflowsApi.viewSubmissionFile(fileUrl);
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;
        const header = new Uint8Array(buffer.slice(0, 5));
        const isPdf = String.fromCharCode(...header) === '%PDF-';
        if (!isPdf) {
          throw new Error(
            'Hồ sơ chưa có bản PDF. Máy local cần cài LibreOffice để xem/ký trên tờ đơn.',
          );
        }
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(1);
      } catch (err) {
        if (!cancelled) {
          const raw = err instanceof Error ? err.message : '';
          setError(
            raw && !/Failed to fetch|Network Error/i.test(raw)
              ? raw
              : 'Không tải được bản xem trước PDF. Máy local cần LibreOffice để chuyển Word sang PDF.',
          );
          // eslint-disable-next-line no-console
          console.error('PDF preview error', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [fileUrl]);

  const renderPage = useCallback(async () => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    try {
      const page = await doc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = CANVAS_WIDTH / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setDisplay({ w: viewport.width, h: viewport.height });
      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      await renderTask.promise;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('render page error', err);
    }
  }, [pageNum]);

  useEffect(() => {
    if (!loading && numPages > 0) {
      void renderPage();
    }
  }, [loading, numPages, pageNum, renderPage]);

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...box },
      rectW: rect.width,
      rectH: rect.height,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / drag.rectW;
    const dy = (e.clientY - drag.startY) / drag.rectH;
    setBox((prev) => {
      if (drag.mode === 'move') {
        return {
          ...prev,
          x: clamp(drag.startBox.x + dx, 0, 1 - prev.w),
          y: clamp(drag.startBox.y + dy, 0, 1 - prev.h),
        };
      }
      if (drag.mode === 'resize') {
        return {
          ...prev,
          w: clamp(drag.startBox.w + dx, 0.08, 1 - prev.x),
          h: clamp(drag.startBox.h + dy, 0.04, 1 - prev.y),
        };
      }
      return prev;
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  if (error) {
    return (
      <div className="p-3 border border-amber-200/80 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 rounded-md">
        <Typography.Text type="warning">{error}</Typography.Text>
        <div className="text-xs text-[var(--app-text-muted)] mt-1">
          Bạn vẫn có thể ký; chữ ký sẽ được đặt vào trang xác nhận cuối tài liệu.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Typography.Text type="secondary" className="text-xs">
          Kéo để di chuyển, kéo góc phải-dưới để đổi kích thước khung chữ ký.
        </Typography.Text>
        {numPages > 1 && (
          <Space size="small">
            <Button
              size="small"
              icon={<LeftOutlined />}
              disabled={pageNum <= 1}
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            />
            <span className="text-xs text-[var(--app-text-muted)]">
              {pageNum}/{numPages}
            </span>
            <Button
              size="small"
              icon={<RightOutlined />}
              disabled={pageNum >= numPages}
              onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            />
          </Space>
        )}
      </div>

      <Spin spinning={loading}>
        <div className="flex justify-center bg-[var(--app-bg)] rounded-md p-2 overflow-auto max-h-[420px]">
          <div
            ref={overlayRef}
            className="relative shadow-sm"
            style={{ width: display.w, height: display.h }}
          >
            <canvas ref={canvasRef} className="block" />

            <div
              onPointerDown={onPointerDown('move')}
              className="absolute border border-dashed border-slate-400/70 bg-white/85 cursor-move touch-none flex flex-col overflow-hidden"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
            >
              <div className="shrink-0 px-1 py-0.5 text-[8px] font-semibold text-slate-500 bg-white/80 pointer-events-none select-none truncate border-b border-dashed border-slate-300/80">
                {boxLabel}
              </div>

              <div className="flex-1 flex flex-col min-h-0 pointer-events-none px-1.5 py-0.5">
                <div className="flex-1 flex items-center justify-center min-h-0">
                  {signatureImageUrl && !imageBroken ? (
                    <img
                      src={signatureImageUrl}
                      alt="chữ ký"
                      draggable={false}
                      onError={() => setImageBroken(true)}
                      className="max-w-full max-h-full object-contain select-none"
                    />
                  ) : (
                    <span className="text-[8px] text-amber-600 text-center select-none px-1">
                      {signatureImageUrl
                        ? 'Không tải được ảnh chữ ký — vào Tài khoản tải lại'
                        : 'Chưa có ảnh chữ ký'}
                    </span>
                  )}
                </div>
                <div className="shrink-0 mx-auto w-[55%] border-t border-slate-800 mt-0.5" />
                <div className="shrink-0 border-t border-slate-400/70 mt-1 pt-0.5 space-y-0.5">
                  <div className="flex items-baseline justify-between gap-1 text-[8px] leading-tight select-none">
                    <span className="text-slate-400 shrink-0">Ký bởi:</span>
                    <span className="font-semibold text-slate-900 truncate text-right">
                      {signerName || '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-1 text-[8px] leading-tight select-none">
                    <span className="text-slate-400 shrink-0">Ngày ký:</span>
                    <span className="font-semibold text-slate-900 truncate text-right">
                      {new Date().toLocaleString('en-GB', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      }).replace(',', '')}{' '}
                      GMT+7
                    </span>
                  </div>
                </div>
              </div>

              <div
                onPointerDown={onPointerDown('resize')}
                className="absolute right-0 bottom-0 w-3 h-3 bg-slate-500 cursor-nwse-resize touch-none"
                style={{ transform: 'translate(30%, 30%)' }}
              />
            </div>
          </div>
        </div>
      </Spin>
    </div>
  );
}
