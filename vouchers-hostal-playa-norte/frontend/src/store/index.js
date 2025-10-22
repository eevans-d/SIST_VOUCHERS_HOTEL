import { create } from 'zustand';

export const useAuth = create((set) => ({
  user: null,
  token: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));

export const useStays = create((set) => ({
  stays: [],
  current: null,
  loading: false,

  setStays: (stays) => set({ stays }),
  setCurrent: (current) => set({ current }),
  setLoading: (loading) => set({ loading }),
}));

export const useVouchers = create((set) => ({
  vouchers: [],
  current: null,
  loading: false,

  setVouchers: (vouchers) => set({ vouchers }),
  setCurrent: (current) => set({ current }),
  setLoading: (loading) => set({ loading }),
}));

export const useOrders = create((set) => ({
  orders: [],
  current: null,
  loading: false,

  setOrders: (orders) => set({ orders }),
  setCurrent: (current) => set({ current }),
  setLoading: (loading) => set({ loading }),
}));

export const useReports = create((set) => ({
  reports: {},
  loading: false,

  setReports: (reports) => set({ reports }),
  setLoading: (loading) => set({ loading }),
}));
