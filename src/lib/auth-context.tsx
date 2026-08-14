"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "sns.currentUser";

type AuthContextValue = {
  userName: string | null;
  checked: boolean;
  login: (name: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userName, setUserName] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // localStorage doesn't exist during SSR, so the real value can only be read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserName(localStorage.getItem(STORAGE_KEY));
    setChecked(true);
  }, []);

  function login(name: string) {
    localStorage.setItem(STORAGE_KEY, name);
    setUserName(name);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUserName(null);
  }

  return (
    <AuthContext.Provider value={{ userName, checked, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
