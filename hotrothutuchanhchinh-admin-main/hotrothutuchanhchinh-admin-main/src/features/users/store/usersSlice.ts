import { createSlice } from '@reduxjs/toolkit';
import type { UserListItem } from '../types/users.types';

interface UsersState {
  users: UserListItem[];
  isLoading: boolean;
}

const initialState: UsersState = {
  users: [],
  isLoading: false,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setUsers: (state, action) => {
      state.users = action.payload;
    },
  },
});

export const { setUsers } = usersSlice.actions;
export const usersReducer = usersSlice.reducer;
