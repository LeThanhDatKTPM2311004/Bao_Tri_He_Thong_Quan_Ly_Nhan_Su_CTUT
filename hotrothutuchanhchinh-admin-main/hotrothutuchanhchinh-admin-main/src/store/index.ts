import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@/features/auth/store/authSlice';
import { dashboardReducer } from '@/features/dashboard/store/dashboardSlice';
import { workflowsReducer } from '@/features/workflows/store/workflowsSlice';
import { notificationsReducer } from '@/features/notifications/store/notificationsSlice';
import { reportsReducer } from '@/features/reports/store/reportsSlice';
import { usersReducer } from '@/features/users/store/usersSlice';
import { settingsReducer } from '@/features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    workflows: workflowsReducer,
    notifications: notificationsReducer,
    reports: reportsReducer,
    users: usersReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
