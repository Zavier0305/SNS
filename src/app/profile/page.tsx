"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  const { profile, checked } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (checked && !profile) router.push("/login");
  }, [checked, profile, router]);

  if (!checked || !profile) return null;

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto">
        <ProfileView profile={profile} currentUserId={profile.id} isFollowing={false} />
      </main>
    </>
  );
}
