// Forum API client for community module
// This module provides types and API client for the independent forum backend service.

const API_BASE =
  process.env.NEXT_PUBLIC_FORUM_API || "https://lt.xianan.xin:1563/api/forum";

export type Post = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  likeCount: number;
  replyCount: number;
  isLikedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Reply = {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  likeCount: number;
  isLikedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListPostsOptions = {
  q?: string;
  sort?: "latest" | "hot";
  page?: number;
  pageSize?: number;
};

export type ListPostsResult = {
  items: Post[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type CreatePostPayload = {
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
};

export type CreateReplyPayload = {
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
};

export type LikeToggleResult = {
  liked: boolean;
  likeCount: number;
};

class ForumError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ForumError";
    this.status = status;
  }
}

async function forumFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    try {
      const json = (await res.json()) as { error?: string };
      throw new ForumError(json.error || `Request failed (${res.status})`, res.status);
    } catch (error) {
      if (error instanceof ForumError) throw error;
      const text = await res.text().catch(() => "Unknown error");
      throw new ForumError(text || `Request failed (${res.status})`, res.status);
    }
  }
  return (await res.json()) as T;
}

export async function getPosts(
  opts: ListPostsOptions & { viewerId?: string } = {}
): Promise<ListPostsResult> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.viewerId) params.set("viewerId", opts.viewerId);
  const qs = params.toString();
  return forumFetch<ListPostsResult>(`/posts${qs ? `?${qs}` : ""}`);
}

export async function getPost(postId: string, viewerId?: string): Promise<Post> {
  const qs = viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : "";
  return forumFetch<Post>(`/posts/${encodeURIComponent(postId)}${qs}`);
}

export async function createPost(payload: CreatePostPayload): Promise<Post> {
  return forumFetch<Post>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getReplies(
  postId: string,
  opts?: { page?: number; pageSize?: number; viewerId?: string }
): Promise<{ items: Reply[]; pagination: ListPostsResult["pagination"] }> {
  const params = new URLSearchParams();
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts?.viewerId) params.set("viewerId", opts.viewerId);
  const qs = params.toString();
  return forumFetch(`/posts/${encodeURIComponent(postId)}/replies${qs ? `?${qs}` : ""}`);
}

export async function createReply(
  postId: string,
  payload: CreateReplyPayload
): Promise<Reply> {
  return forumFetch<Reply>(`/posts/${encodeURIComponent(postId)}/replies`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function togglePostLike(
  postId: string,
  viewerId: string
): Promise<LikeToggleResult> {
  return forumFetch<LikeToggleResult>(
    `/posts/${encodeURIComponent(postId)}/like-toggle`,
    {
      method: "POST",
      body: JSON.stringify({ viewerId }),
    }
  );
}

export async function toggleReplyLike(
  replyId: string,
  viewerId: string
): Promise<LikeToggleResult> {
  return forumFetch<LikeToggleResult>(
    `/replies/${encodeURIComponent(replyId)}/like-toggle`,
    {
      method: "POST",
      body: JSON.stringify({ viewerId }),
    }
  );
}

export async function deletePost(postId: string, adminToken: string): Promise<{ ok: boolean }> {
  return forumFetch<{ ok: boolean }>(`/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${adminToken}`,
    },
  });
}

export async function deleteReply(replyId: string, adminToken: string): Promise<{ ok: boolean }> {
  return forumFetch<{ ok: boolean }>(`/replies/${encodeURIComponent(replyId)}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${adminToken}`,
    },
  });
}

export async function resetForumDb(adminToken: string): Promise<{ ok: boolean; postCount: number; replyCount: number }> {
  return forumFetch<{ ok: boolean; postCount: number; replyCount: number }>("/admin/reset", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${adminToken}`,
    },
  });
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export { ForumError };
