"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchProfileByHandle } from "@/lib/profiles-store";
import { fetchFollowerProfiles, fetchFollowingProfiles } from "@/lib/follows-store";
import type { Profile } from "@/lib/types";

export default function FollowsListPage() {
  const { profile: myProfile, checked } = useAuth();
  const router = useRouter();
  const params = useParams<{ handle: string; kind: string }>();
  const kind = params.kind === "followers" ? "followers" : "following";
  const [targetProfile, setTargetProfile] = useState<Profile | null | undefined>(undefined);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && !myProfile) router.push("/login");
  }, [checked, myProfile, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchProfileByHandle(params.handle).then((p) => {
      setTargetProfile(p);
      if (!p) {
        setLoading(false);
        return;
      }
      const fetcher = kind === "followers" ? fetchFollowerProfiles : fetchFollowingProfiles;
      fetcher(p.id)
        .then(setUsers)
        .finally(() => setLoading(false));
    });
  }, [params.handle, kind]);

  if (!checked || !myProfile) return null;

  return (
    <>
      <main className="flex-1 w-full max-w-xl mx-auto">
        <h1 className="p-4 text-lg font-semibold border-b border-black/10 dark:border-white/10">
          @{params.handle} の{kind === "followers" ? "フォロワー" : "フォロー中"}
        </h1>
        {loading ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">読み込み中...</p>
        ) : targetProfile === null ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            ユーザーが見つかりません。
          </p>
        ) : users.length === 0 ? (
          <p className="p-4 text-sm text-black/50 dark:text-white/50">
            まだ{kind === "followers" ? "フォロワーがいません" : "誰もフォローしていません"}。
          </p>
        ) : (
          users.map((u) => (
            <Link
              key={u.id}
              href={`/u/${u.handle}`}
              className="block p-4 border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="font-semibold text-sm">{u.displayName}</span>
              <span className="text-xs text-black/40 dark:text-white/40 ml-2">@{u.handle}</span>
            </Link>
          ))
        )}
      </main>
    </>
  );
}
