import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, type User } from '../lib/api';

type AuthState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
  login: (payload: {
    email?: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  register: (payload: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  loginWithOtp: (phone: string, code: string) => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,

      setSession: (token, user) => {
        localStorage.setItem('sb_token', token);
        set({ token, user });
      },

      logout: () => {
        localStorage.removeItem('sb_token');
        set({ token: null, user: null });
      },

      refreshMe: async () => {
        const token = get().token || localStorage.getItem('sb_token');
        if (!token) return;
        try {
          const { data } = await api.get<User>('/auth/me');
          set({ user: data, token });
        } catch {
          get().logout();
        }
      },

      login: async (payload) => {
        set({ loading: true });
        try {
          const { data } = await api.post('/auth/login', payload);
          get().setSession(data.accessToken, data.user);
        } finally {
          set({ loading: false });
        }
      },

      register: async (payload) => {
        set({ loading: true });
        try {
          const { data } = await api.post('/auth/register', payload);
          get().setSession(data.accessToken, data.user);
        } finally {
          set({ loading: false });
        }
      },

      loginWithOtp: async (phone, code) => {
        set({ loading: true });
        try {
          const { data } = await api.post('/auth/otp/verify', { phone, code });
          get().setSession(data.accessToken, data.user);
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'sb-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          localStorage.setItem('sb_token', state.token);
        }
      },
    },
  ),
);
