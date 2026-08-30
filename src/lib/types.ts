export type Profile = {
  id: string;
  handle: string;
  displayName: string;
  createdAt: string;
};

export type Post = {
  id: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
};

export type FeedKind = "recommended" | "following";
