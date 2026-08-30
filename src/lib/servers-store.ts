"use client";

import { supabase } from "@/lib/supabase/client";

export type ServerRole = "owner" | "moderator" | "member";

export type Server = {
  id: string;
  name: string;
  topic: string | null;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
  memberCount: number;
  myRole: ServerRole | null;
  welcomeMessage: string | null;
};

export type Channel = {
  id: string;
  serverId: string;
  name: string;
  createdAt: string;
  lastPostAt: string | null;
  postsLocked: boolean;
};

export type ServerMember = {
  userId: string;
  handle: string;
  displayName: string;
  role: ServerRole;
};

export type JoinRequest = {
  userId: string;
  handle: string;
  displayName: string;
  createdAt: string;
};

export async function fetchServers(viewerId: string | null): Promise<Server[]> {
  const { data: servers } = await supabase
    .from("sns_servers")
    .select("*")
    .order("created_at", { ascending: false });
  if (!servers) return [];

  const { data: members } = await supabase
    .from("sns_server_members")
    .select("server_id, user_id, role");

  return servers.map((s) => {
    const serverMembers = (members ?? []).filter((m) => m.server_id === s.id);
    const mine = viewerId
      ? serverMembers.find((m) => m.user_id === viewerId)
      : undefined;
    return {
      id: s.id,
      name: s.name,
      topic: s.topic,
      ownerId: s.owner_id,
      isPublic: s.is_public,
      createdAt: s.created_at,
      memberCount: serverMembers.length,
      myRole: (mine?.role as ServerRole) ?? null,
      welcomeMessage: s.welcome_message,
    };
  });
}

export async function fetchServer(
  serverId: string,
  viewerId: string | null,
): Promise<Server | null> {
  const { data: s } = await supabase
    .from("sns_servers")
    .select("*")
    .eq("id", serverId)
    .single();
  if (!s) return null;

  const { data: members } = await supabase
    .from("sns_server_members")
    .select("user_id, role")
    .eq("server_id", serverId);

  const mine = viewerId
    ? (members ?? []).find((m) => m.user_id === viewerId)
    : undefined;

  return {
    id: s.id,
    name: s.name,
    topic: s.topic,
    ownerId: s.owner_id,
    isPublic: s.is_public,
    createdAt: s.created_at,
    memberCount: (members ?? []).length,
    myRole: (mine?.role as ServerRole) ?? null,
    welcomeMessage: s.welcome_message,
  };
}

export async function createServer(
  ownerId: string,
  name: string,
  topic: string,
  isPublic: boolean,
): Promise<string> {
  const { data, error } = await supabase
    .from("sns_servers")
    .insert({ owner_id: ownerId, name, topic: topic || null, is_public: isPublic })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("作成に失敗しました");
  return data.id;
}

export async function joinServer(serverId: string) {
  const { error } = await supabase.rpc("sns_join_server", { p_server_id: serverId });
  if (error) throw error;
}

export async function leaveServer(serverId: string) {
  const { error } = await supabase.rpc("sns_leave_server", { p_server_id: serverId });
  if (error) throw error;
}

export async function fetchChannels(serverId: string): Promise<Channel[]> {
  const { data } = await supabase
    .from("sns_channels")
    .select("*")
    .eq("server_id", serverId)
    .order("created_at", { ascending: true });
  const channels = data ?? [];
  const channelIds = channels.map((c) => c.id);
  const lastPostAt = new Map<string, string>();
  if (channelIds.length > 0) {
    const { data: posts } = await supabase
      .from("sns_posts")
      .select("channel_id, created_at")
      .in("channel_id", channelIds)
      .order("created_at", { ascending: false });
    for (const row of posts ?? []) {
      if (row.channel_id && !lastPostAt.has(row.channel_id)) {
        lastPostAt.set(row.channel_id, row.created_at);
      }
    }
  }
  return channels.map((c) => ({
    id: c.id,
    serverId: c.server_id,
    name: c.name,
    createdAt: c.created_at,
    lastPostAt: lastPostAt.get(c.id) ?? null,
    postsLocked: c.posts_locked,
  }));
}

export async function createChannel(serverId: string, name: string, postsLocked = false) {
  const { error } = await supabase
    .from("sns_channels")
    .insert({ server_id: serverId, name, posts_locked: postsLocked });
  if (error) throw error;
}

export async function setChannelLocked(channelId: string, postsLocked: boolean) {
  const { error } = await supabase
    .from("sns_channels")
    .update({ posts_locked: postsLocked })
    .eq("id", channelId);
  if (error) throw error;
}

export async function updateServerTopic(serverId: string, topic: string) {
  const { error } = await supabase
    .from("sns_servers")
    .update({ topic: topic.trim() || null })
    .eq("id", serverId);
  if (error) throw error;
}

export async function updateServerVisibility(serverId: string, isPublic: boolean) {
  const { error } = await supabase
    .from("sns_servers")
    .update({ is_public: isPublic })
    .eq("id", serverId);
  if (error) throw error;
}

export async function updateServerWelcomeMessage(serverId: string, message: string) {
  const { error } = await supabase
    .from("sns_servers")
    .update({ welcome_message: message.trim() || null })
    .eq("id", serverId);
  if (error) throw error;
}

export async function deleteChannel(channelId: string) {
  const { error } = await supabase.from("sns_channels").delete().eq("id", channelId);
  if (error) throw error;
}

export async function deleteServer(serverId: string) {
  const { error } = await supabase.from("sns_servers").delete().eq("id", serverId);
  if (error) throw error;
}

export async function fetchMembers(serverId: string): Promise<ServerMember[]> {
  const { data } = await supabase
    .from("sns_server_members")
    .select("user_id, role, sns_profiles(handle, display_name)")
    .eq("server_id", serverId);
  return (data ?? []).map((m) => ({
    userId: m.user_id,
    handle: m.sns_profiles?.handle ?? "",
    displayName: m.sns_profiles?.display_name ?? "名無しさん",
    role: m.role as ServerRole,
  }));
}

export async function fetchJoinRequests(serverId: string): Promise<JoinRequest[]> {
  const { data } = await supabase
    .from("sns_server_join_requests")
    .select("user_id, created_at, sns_profiles(handle, display_name)")
    .eq("server_id", serverId);
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    handle: r.sns_profiles?.handle ?? "",
    displayName: r.sns_profiles?.display_name ?? "名無しさん",
    createdAt: r.created_at,
  }));
}

export async function approveJoinRequest(serverId: string, userId: string) {
  const { error } = await supabase.rpc("sns_approve_join_request", {
    p_server_id: serverId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function rejectJoinRequest(serverId: string, userId: string) {
  const { error } = await supabase.rpc("sns_reject_join_request", {
    p_server_id: serverId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function kickMember(serverId: string, userId: string) {
  const { error } = await supabase.rpc("sns_kick_member", {
    p_server_id: serverId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function setMemberRole(
  serverId: string,
  userId: string,
  role: "moderator" | "member",
) {
  const { error } = await supabase.rpc("sns_set_member_role", {
    p_server_id: serverId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function createServerInvite(serverId: string): Promise<string> {
  const { data, error } = await supabase.rpc("sns_create_server_invite", {
    p_server_id: serverId,
  });
  if (error) throw error;
  return data as string;
}

export async function joinViaInvite(inviteId: string): Promise<string> {
  const { data, error } = await supabase.rpc("sns_join_via_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  return data as string;
}

export async function togglePin(postId: string, pinned: boolean) {
  const { error } = await supabase
    .from("sns_posts")
    .update({ is_pinned: !pinned })
    .eq("id", postId);
  if (error) throw error;
}
