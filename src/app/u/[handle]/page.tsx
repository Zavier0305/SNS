"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFollowingIds } from "@/lib/posts-store";
import { fetchProfileByHandle } from "@/lib/profiles-store";
import { Header } from "@/components/Header";
import { ProfileView } from "@/components/ProfileView";
import type { Profile } from "@/lib/types";

export default function UserProfilePage() {
  const { profile: myProfile, checked } = useAuth();
  const router = useRouter();
  const params = useParams<{ handle: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const { followingIds } = useFollowingIds(myProfile?.id ?? null);

  useEffect(() => {
    if (checked && !myProfile) router.push("/login");
  }, [checked, myProfile, router]);

  useEffect(() => {
    fetchProfileByHandle(params.handle).then(setProfile);
  }, [params.handle]);

  if (!checked || !myProfile) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        {profile === undefined ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : profile === null ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            ユーザーが見つかりません。
          </p>
        ) : (
          <ProfileView
            profile={profile}
            currentUserId={myProfile.id}
            isFollowing={followingIds.has(profile.id)}
          />
        )}
      </main>
    </>
  );
}
