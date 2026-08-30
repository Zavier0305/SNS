"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import type { NotificationPrefs, Profile } from "@/lib/types";

type AuthContextValue = {
  profile: Profile | null;
  checked: boolean;
  login: (nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updateThemeColor: (color: string | null) => Promise<void>;
  updateNotificationPrefs: (prefs: NotificationPrefs) => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  updateCoverUrl: (coverUrl: string | null) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toProfile(row: {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
  theme_color: string | null;
  bio: string | null;
  cover_url: string | null;
}): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    createdAt: row.created_at,
    themeColor: row.theme_color,
    bio: row.bio,
    coverUrl: row.cover_url,
  };
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("sns_profiles")
    .select("id, handle, display_name, created_at, theme_color, bio, cover_url")
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

  async function updateNickname(nickname: string) {
    if (!profile) throw new Error("ログインしていません");
    const trimmed = nickname.trim();
    if (!trimmed) throw new Error("ニックネームを入力してください");
    const { error } = await supabase
      .from("sns_profiles")
      .update({ display_name: trimmed })
      .eq("id", profile.id);
    if (error) throw error;
    setProfile({ ...profile, displayName: trimmed });
  }

  async function updateThemeColor(color: string | null) {
    if (!profile) throw new Error("ログインしていません");
    const { error } = await supabase
      .from("sns_profiles")
      .update({ theme_color: color })
      .eq("id", profile.id);
    if (error) throw error;
    setProfile({ ...profile, themeColor: color });
  }

  async function updateNotificationPrefs(prefs: NotificationPrefs) {
    if (!profile) throw new Error("ログインしていません");
    const { error } = await supabase
      .from("sns_profiles")
      .update({
        notify_likes: prefs.notifyLikes,
        notify_comments: prefs.notifyComments,
        notify_follows: prefs.notifyFollows,
      })
      .eq("id", profile.id);
    if (error) throw error;
  }

  async function updateBio(bio: string) {
    if (!profile) throw new Error("ログインしていません");
    const trimmed = bio.trim();
    const { error } = await supabase
      .from("sns_profiles")
      .update({ bio: trimmed || null })
      .eq("id", profile.id);
    if (error) throw error;
    setProfile({ ...profile, bio: trimmed || null });
  }

  async function updateCoverUrl(coverUrl: string | null) {
    if (!profile) throw new Error("ログインしていません");
    const { error } = await supabase
      .from("sns_profiles")
      .update({ cover_url: coverUrl })
      .eq("id", profile.id);
    if (error) throw error;
    setProfile({ ...profile, coverUrl });
  }

  async function deleteAccount() {
    if (!profile) throw new Error("ログインしていません");
    const { error } = await supabase.rpc("sns_delete_account");
    if (error) throw error;
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        profile,
        checked,
        login,
        logout,
        updateNickname,
        updateThemeColor,
        updateNotificationPrefs,
        updateBio,
        updateCoverUrl,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
