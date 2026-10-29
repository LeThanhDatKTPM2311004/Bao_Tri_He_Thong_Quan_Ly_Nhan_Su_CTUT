import { createSlice } from '@reduxjs/toolkit';

interface SettingsState {
  isLoading: boolean;
}

const initialState: SettingsState = {
  isLoading: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
});

export const settingsReducer = settingsSlice.reducer;
