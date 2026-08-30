export type Profile = {
  id: string;
  handle: string;
  displayName: string;
  createdAt: string;
  themeColor: string | null;
  bio: string | null;
  coverUrl: string | null;
  pinnedPostId: string | null;
};

export type NotificationPrefs = {
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
};

export type PollOption = { label: string; votes: number };

export type Post = {
  id: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  content: string;
  imageUrls: string[];
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
  isSensitive: boolean;
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
