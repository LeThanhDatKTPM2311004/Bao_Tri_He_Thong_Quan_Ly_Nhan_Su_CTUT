import mongoose from 'mongoose';
import User from '../src/modules/users/user.model.js';
import { askAdmin } from '../src/modules/chatbot/adminChatbot.service.js';
import { ask } from '../src/modules/chatbot/chatbot.service.js';

await mongoose.connect(process.env.MONGO_URI);
const admin = await User.findOne({ role: 'admin' }).select('_id email role');
const user = { id: String(admin._id), email: admin.email, role: 'admin' };

for (const q of [
  'Hieu truong ten gi',
  'Truong khoa CNTT la ai',
  'Pho hieu truong ten gi',
  'Truong khoa cong nghe thong tin',
]) {
  const r = await askAdmin({ message: q, user });
  console.log('ADMIN', q, '=>', r.intent);
  console.log((r.answer || '').slice(0, 240).replace(/\n/g, ' | '));
  console.log('---');
}

const s = await ask({ message: 'Truong khoa CNTT ten gi', user: null });
console.log('SV', s.intent, (s.answer || '').slice(0, 200).replace(/\n/g, ' | '));

const p = await User.countDocuments({ role: 'principal', isActive: true });
const d = await User.countDocuments({ role: 'faculty_manager', isActive: true });
console.log('counts principal', p, 'faculty_manager', d);

await mongoose.disconnect();
