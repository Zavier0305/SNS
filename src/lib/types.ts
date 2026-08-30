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
  expireAt: string;
  isPreserved: boolean;
  isHidden: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  content: string;
  createdAt: string;
};

export type FeedKind = "recommended" | "following";
