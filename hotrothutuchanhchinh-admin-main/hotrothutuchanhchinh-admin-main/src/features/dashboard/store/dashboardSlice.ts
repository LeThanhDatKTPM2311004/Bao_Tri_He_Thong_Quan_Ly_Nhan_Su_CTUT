import { createSlice } from '@reduxjs/toolkit';
import type { DashboardStats } from '../types/dashboard.types';

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
}

const initialState: DashboardState = {
  stats: null,
  isLoading: false,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setStats: (state, action) => {
      state.stats = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setStats, setLoading } = dashboardSlice.actions;
export const dashboardReducer = dashboardSlice.reducer;
