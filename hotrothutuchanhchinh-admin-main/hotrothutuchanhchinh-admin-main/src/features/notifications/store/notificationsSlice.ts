import { createSlice } from '@reduxjs/toolkit';
import type { Notification } from '../types/notifications.types';

interface NotificationsState {
  items: Notification[];
  unreadCount: number;
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications: (state, action) => {
      state.items = action.payload;
    },
    setUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    },
  },
});

export const { setNotifications, setUnreadCount } = notificationsSlice.actions;
export const notificationsReducer = notificationsSlice.reducer;
