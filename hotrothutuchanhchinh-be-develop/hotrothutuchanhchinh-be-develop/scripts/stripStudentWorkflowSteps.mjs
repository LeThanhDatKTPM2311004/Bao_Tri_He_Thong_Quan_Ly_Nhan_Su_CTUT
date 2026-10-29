/**
 * Gỡ bước role=student khỏi mọi workflow; đánh lại stepOrder; fromRole bước 1 = student.
 *   node scripts/stripStudentWorkflowSteps.mjs --confirm
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.argv.includes('--confirm')) {
  console.error('Thêm --confirm để chạy.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const col = mongoose.connection.db.collection('workflows');
const workflows = await col.find({}).toArray();
let updated = 0;

for (const wf of workflows) {
  const steps = Array.isArray(wf.steps) ? wf.steps : [];
  const cleaned = steps.filter((s) => s?.role && s.role !== 'student');
  const nextSteps = cleaned.map((step, index) => ({
    ...step,
    stepOrder: index + 1,
    fromRole: index === 0 ? 'student' : cleaned[index - 1].role,
    stepName: step.stepName || step.role,
  }));

  const changed =
    nextSteps.length !== steps.length ||
    JSON.stringify(
      steps.map((s) => ({ o: s.stepOrder, r: s.role, f: s.fromRole })),
    ) !==
      JSON.stringify(
        nextSteps.map((s) => ({ o: s.stepOrder, r: s.role, f: s.fromRole })),
      );

  if (!changed) continue;

  if (!nextSteps.length && steps.length) {
    console.warn(`Workflow ${wf._id} (${wf.name}) chỉ có bước SV — để trống, cần cấu hình lại`);
  }

  await col.updateOne({ _id: wf._id }, { $set: { steps: nextSteps, updatedAt: new Date() } });
  updated += 1;
  console.log(
    `Updated ${wf.name || wf._id}: ${steps.length} → ${nextSteps.length}`,
    nextSteps.map((s) => `${s.stepOrder}:${s.role}`).join(' → ') || '(empty)',
  );
}

console.log(`Done. Updated ${updated}/${workflows.length} workflows.`);
await mongoose.disconnect();
