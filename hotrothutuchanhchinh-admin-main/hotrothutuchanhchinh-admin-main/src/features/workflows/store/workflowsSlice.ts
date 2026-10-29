import { createSlice } from '@reduxjs/toolkit';
import type { PendingTask } from '../types/workflows.types';

interface WorkflowsState {
  pendingTasks: PendingTask[];
  isLoading: boolean;
}

const initialState: WorkflowsState = {
  pendingTasks: [],
  isLoading: false,
};

const workflowsSlice = createSlice({
  name: 'workflows',
  initialState,
  reducers: {
    setPendingTasks: (state, action) => {
      state.pendingTasks = action.payload;
    },
  },
});

export const { setPendingTasks } = workflowsSlice.actions;
export const workflowsReducer = workflowsSlice.reducer;
