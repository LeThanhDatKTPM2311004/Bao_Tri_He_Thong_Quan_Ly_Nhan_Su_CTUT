/**
 * Đổi mã nội bộ trợ lý:
 * - Quyen: tro_ly_truong_khoa → tro_ly_khoa, tro_ly_truong_phong → tro_ly_phong
 * - User.role: faculty_dean_assistant → khoa_assistant, ...
 */
import Quyen from '../../modules/organization/models/quyen.model.js';
import User from '../../modules/users/user.model.js';
import GiangVienQuyen from '../../modules/organization/models/giangVienQuyen.model.js';

const QUYEN_CODE_RENAMES = [
  ['tro_ly_truong_khoa', 'tro_ly_khoa'],
  ['tro_ly_truong_phong', 'tro_ly_phong'],
];

const USER_ROLE_RENAMES = [
  ['faculty_dean_assistant', 'khoa_assistant'],
  ['office_head_assistant', 'phong_assistant'],
  ['center_director_assistant', 'trung_tam_assistant'],
];

export const migrateAssistantInternalCodes = async () => {
  for (const [fromCode, toCode] of QUYEN_CODE_RENAMES) {
    const fromDoc = await Quyen.findOne({ code: fromCode });
    const toDoc = await Quyen.findOne({ code: toCode });

    if (fromDoc && toDoc && String(fromDoc._id) !== String(toDoc._id)) {
      await GiangVienQuyen.updateMany({ quyenId: fromDoc._id }, { $set: { quyenId: toDoc._id } });
      await Quyen.deleteOne({ _id: fromDoc._id });
      console.log(`[Migrate] Quyen merged ${fromCode} → ${toCode}`);
      continue;
    }

    if (fromDoc && !toDoc) {
      fromDoc.code = toCode;
      await fromDoc.save();
      console.log(`[Migrate] Quyen renamed ${fromCode} → ${toCode}`);
    }
  }

  for (const [fromRole, toRole] of USER_ROLE_RENAMES) {
    const res = await User.updateMany({ role: fromRole }, { $set: { role: toRole } });
    if (res.modifiedCount > 0) {
      console.log(`[Migrate] User.role ${fromRole} → ${toRole} (${res.modifiedCount})`);
    }
  }
};
