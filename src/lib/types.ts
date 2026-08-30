export type Profile = {
  id: string;
  handle: string;
  displayName: string;
  createdAt: string;
};

export type PollOption = { label: string; votes: number };

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
  quotedPostId: string | null;
  quotedContent: string | null;
  quotedAuthorHandle: string | null;
  quotedAuthorDisplayName: string | null;
  pollOptions: string[] | null;
  myPollVote: number | null;
  channelId: string | null;
  isPinned: boolean;
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
