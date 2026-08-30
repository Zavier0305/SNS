"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type AuthContextValue = {
  profile: Profile | null;
  checked: boolean;
  login: (nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toProfile(row: {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
}): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("sns_profiles")
    .select("id, handle, display_name, created_at")
    .eq("id", userId)
    .single();
  return data ? toProfile(data) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    async function applySession(userId: string | undefined) {
      const nextProfile = userId ? await fetchProfile(userId) : null;
      if (!active) return;
      setProfile(nextProfile);
      setChecked(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session?.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(nickname?: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    let userId = sessionData.session?.user.id;

    if (!userId) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      userId = data.user?.id;
    }
    if (!userId) throw new Error("ログインに失敗しました");

    const trimmed = nickname?.trim();
    if (trimmed) {
      await supabase
        .from("sns_profiles")
        .update({ display_name: trimmed })
        .eq("id", userId);
    }

    setProfile(await fetchProfile(userId));
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ profile, checked, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
