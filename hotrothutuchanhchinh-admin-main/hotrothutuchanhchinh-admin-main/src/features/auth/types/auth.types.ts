import type { Role } from '@/shared/constants/roles';

export interface User {
  _id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions?: string[];
  studentId?: string;
  phone?: string;
  department?: string;
  faculty?: string;
  avatar?: string;
  signatureImageUrl?: string;
  smartCaUserId?: string;
  smartCaVerifiedAt?: string | null;
  smartCaCertSubject?: string;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  address?: string;
  lastLoginAt?: string;
  mustChangePassword?: boolean;
  googleLinked?: boolean;
  googleEmail?: string;
  googlePicture?: string;
  googleLinkedAt?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface GoogleLoginPayload {
  idToken: string;
  rememberMe?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  linkedGoogleNow?: boolean;
}
