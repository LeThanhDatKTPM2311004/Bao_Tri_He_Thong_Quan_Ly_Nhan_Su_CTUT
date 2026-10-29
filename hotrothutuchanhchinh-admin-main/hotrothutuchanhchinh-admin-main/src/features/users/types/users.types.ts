import type { Role } from '@/shared/constants/roles';

export interface UserListItem {
  _id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  studentId?: string;
  department?: string;
  faculty?: string;
  khoaId?: string;
  boMonId?: string;
  lopId?: string;
  sinhVienId?: string;
  giangVienId?: string;
  phone?: string;
  lastLoginAt?: string;
}
