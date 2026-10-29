import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../services/authApi';
import { tokenStorage } from '@/services/storage/tokenStorage';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import type { AuthState, GoogleLoginPayload, LoginCredentials, LoginResponse, User } from '../types/auth.types';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      const authData = response.data.data;
      tokenStorage.setTokens(
        authData.accessToken,
        authData.refreshToken,
        credentials.rememberMe ?? false,
      );
      return authData.user;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const loginWithGoogle = createAsyncThunk(
  'auth/googleLogin',
  async (payload: GoogleLoginPayload, { rejectWithValue }) => {
    try {
      const response = await authApi.googleLogin(payload);
      const authData = response.data.data;
      tokenStorage.setTokens(
        authData.accessToken,
        authData.refreshToken,
        payload.rememberMe ?? false,
      );
      return authData as LoginResponse;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchMe = createAsyncThunk('auth/fetchMe', async () => {
  const response = await authApi.getMe();
  return response.data.data;
});

export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await authApi.getMe();
      return response.data.data;
    } catch {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        tokenStorage.clear();
        return rejectWithValue('no_session');
      }

      try {
        const refreshResponse = await authApi.refresh(refreshToken);
        const { accessToken: newAccess, refreshToken: newRefresh } = refreshResponse.data.data;
        tokenStorage.setTokens(newAccess, newRefresh);
        const meResponse = await authApi.getMe();
        return meResponse.data.data;
      } catch {
        tokenStorage.clear();
        return rejectWithValue('session_expired');
      }
    }
  },
);

export const logoutAsync = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } catch {
    // Ignore logout API errors
  }
  tokenStorage.clear();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      tokenStorage.clear();
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error =
          typeof action.payload === 'string' ? action.payload : 'Đăng nhập thất bại';
      })
      .addCase(loginWithGoogle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.isLoading = false;
        state.error =
          typeof action.payload === 'string' ? action.payload : 'Đăng nhập Google thất bại';
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(initializeAuth.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isInitializing = false;
        if (action.payload) {
          state.user = action.payload;
          state.isAuthenticated = true;
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isInitializing = false;
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export const authReducer = authSlice.reducer;
