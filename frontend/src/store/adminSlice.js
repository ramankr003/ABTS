import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const createAdminApi = (token) => axios.create({
  baseURL: `${API_BASE_URL}/admin`,
  headers: { Authorization: `Bearer ${token}` }
});

export const fetchAdminStats = createAsyncThunk('admin/fetchStats', async (_, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    const res = await createAdminApi(token).get('/stats');
    return res.data.stats;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load stats');
  }
});

export const fetchAdminUsers = createAsyncThunk('admin/fetchUsers', async (_, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    const res = await createAdminApi(token).get('/users');
    return res.data.users;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load users');
  }
});

export const toggleUserBan = createAsyncThunk('admin/toggleBan', async (userId, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    await createAdminApi(token).put(`/users/${userId}/ban`);
    return userId; // return ID to update local state
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update user');
  }
});

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    stats: null,
    users: [],
    isLoading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminStats.pending, (state) => { state.isLoading = true; })
      .addCase(fetchAdminStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchAdminStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchAdminUsers.pending, (state) => { state.isLoading = true; })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
      })
      .addCase(toggleUserBan.fulfilled, (state, action) => {
        const user = state.users.find(u => u._id === action.payload);
        if (user) user.isVerified = !user.isVerified;
      });
  },
});

export default adminSlice.reducer;
