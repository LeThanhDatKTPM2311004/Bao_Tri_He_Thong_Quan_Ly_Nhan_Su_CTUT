import User from '../../modules/users/user.model.js';
import PasswordReset from '../../modules/auth/passwordReset.model.js';
import Khoa from '../../modules/organization/models/khoa.model.js';
import BoMon from '../../modules/organization/models/boMon.model.js';
import Lop from '../../modules/organization/models/lop.model.js';
import SinhVien from '../../modules/organization/models/sinhVien.model.js';
import GiangVien from '../../modules/organization/models/giangVien.model.js';
import Quyen from '../../modules/organization/models/quyen.model.js';
import GiangVienQuyen from '../../modules/organization/models/giangVienQuyen.model.js';

export const createIndexes = async () => {
  await User.syncIndexes();
  await PasswordReset.syncIndexes();
  await Khoa.syncIndexes();
  await BoMon.syncIndexes();
  await Lop.syncIndexes();
  await SinhVien.syncIndexes();
  await GiangVien.syncIndexes();
  await Quyen.syncIndexes();
  await GiangVienQuyen.syncIndexes();
};
