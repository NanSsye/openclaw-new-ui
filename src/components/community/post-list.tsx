"use client";

import { Loader2, Search } from "lucide-react";
import { PostCard } from "@/components/community/post-card";
import { Card, CardContent } from "@/components/ui/card";
import { type Post } from "@/lib/forum-api";

type PostListProps = {
  posts: Post[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onLike?: (postId: string) => void;
  likingPostId?: string | null;
};

export function PostList({
  posts,
  loading,
  emptyTitle = "暂无帖子",
  emptyDescription = "还没有人发帖，来发布第一篇内容吧。",
  onLike,
  likingPostId,
}: PostListProps) {
  if (loading) {
    return (
      <Card className="border-border/50 bg-background/70">
        <CardContent className="flex min-h-[180px] items-center justify-center sm:min-h-[220px]">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin sm:size-5" />
            <span>正在加载社区内容...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!posts.length) {
    return (
      <Card className="border-border/50 bg-background/70">
        <CardContent className="flex min-h-[200px] flex-col items-center justify-center px-4 text-center sm:min-h-[240px]">
          <div className="flex size-12 items-center justify-center rounded-full border border-border/50 bg-muted/30 sm:size-16">
            <Search className="size-5 text-muted-foreground/60 sm:size-7" />
          </div>
          <h3 className="mt-4 text-base font-bold sm:mt-5 sm:text-lg">{emptyTitle}</h3>
          <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            {emptyDescription}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-background/70 shadow-sm">
      {posts.map((post) => (
        <div key={post.id} className="border-b border-border/40 last:border-b-0">
          <PostCard
            post={post}
            onLike={onLike ? () => onLike(post.id) : undefined}
            liking={likingPostId === post.id}
          />
        </div>
      ))}
    </div>
  );
}
