import { configureStore } from '@reduxjs/toolkit';
import authReducer      from './authSlice';
import ambulanceReducer from './ambulanceSlice';
import bookingReducer   from './bookingSlice';
import adminReducer     from './adminSlice';

export const store = configureStore({
  reducer: {
    auth:      authReducer,
    ambulance: ambulanceReducer,
    booking:   bookingReducer,
    admin:     adminReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});
