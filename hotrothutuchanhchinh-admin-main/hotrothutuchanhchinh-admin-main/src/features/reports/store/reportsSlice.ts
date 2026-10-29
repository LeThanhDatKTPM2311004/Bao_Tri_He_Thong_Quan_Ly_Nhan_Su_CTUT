import { createSlice } from '@reduxjs/toolkit';

interface ReportsState {
  isLoading: boolean;
  filters: Record<string, unknown>;
}

const initialState: ReportsState = {
  isLoading: false,
  filters: {},
};

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
  },
});

export const { setFilters } = reportsSlice.actions;
export const reportsReducer = reportsSlice.reducer;
