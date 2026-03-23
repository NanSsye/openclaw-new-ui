"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPost,
  createReply,
  getPost,
  getPosts,
  getReplies,
  togglePostLike,
  toggleReplyLike,
  deletePost,
  deleteReply,
  resetForumDb,
  type CreatePostPayload,
  type CreateReplyPayload,
  type ListPostsOptions,
  type Post,
  type Reply,
} from "@/lib/forum-api";

export function usePosts(
  options: ListPostsOptions,
  viewerId?: string
) {
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  const key = useMemo(
    () => JSON.stringify(options),
    [options]
  );
  const stableOptions = useMemo(
    () => JSON.parse(key) as ListPostsOptions,
    [key]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPosts({ ...stableOptions, viewerId });
      setItems(res.items || []);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载帖子失败");
    } finally {
      setLoading(false);
    }
  }, [stableOptions, viewerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, error, pagination, refresh, setItems };
}

export function usePost(postId: string | null, viewerId?: string) {
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const [postRes, repliesRes] = await Promise.all([
        getPost(postId, viewerId),
        getReplies(postId, { viewerId }),
      ]);
      setPost(postRes);
      setReplies(repliesRes.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载帖子详情失败");
    } finally {
      setLoading(false);
    }
  }, [postId, viewerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { post, replies, loading, error, refresh, setPost, setReplies };
}

export function useForumActions(viewer: {
  id: string;
  name: string;
  avatar?: string | null;
}) {
  const submitPost = useCallback(
    (payload: Omit<CreatePostPayload, "authorId" | "authorName" | "authorAvatar">) =>
      createPost({
        ...payload,
        authorId: viewer.id,
        authorName: viewer.name,
        authorAvatar: viewer.avatar,
      }),
    [viewer.avatar, viewer.id, viewer.name]
  );

  const submitReply = useCallback(
    (postId: string, payload: Omit<CreateReplyPayload, "authorId" | "authorName" | "authorAvatar">) =>
      createReply(postId, {
        ...payload,
        authorId: viewer.id,
        authorName: viewer.name,
        authorAvatar: viewer.avatar,
      }),
    [viewer.avatar, viewer.id, viewer.name]
  );

  const likePost = useCallback(
    (postId: string) => togglePostLike(postId, viewer.id),
    [viewer.id]
  );

  const likeReply = useCallback(
    (replyId: string) => toggleReplyLike(replyId, viewer.id),
    [viewer.id]
  );

  const removePost = useCallback(
    (postId: string, adminToken: string) => deletePost(postId, adminToken),
    []
  );

  const removeReply = useCallback(
    (replyId: string, adminToken: string) => deleteReply(replyId, adminToken),
    []
  );

  const resetForum = useCallback(
    (adminToken: string) => resetForumDb(adminToken),
    []
  );

  return { submitPost, submitReply, likePost, likeReply, removePost, removeReply, resetForum };
}
