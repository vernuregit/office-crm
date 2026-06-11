import { create } from "zustand";

const useAuthStore = create((set) => ({
  user:     null,
  userData: null,
  loading:  true,
  setUser:     (user)     => set({ user }),
  setUserData: (userData) => set({ userData }),
  setLoading:  (loading)  => set({ loading }),
}));

export default useAuthStore;
