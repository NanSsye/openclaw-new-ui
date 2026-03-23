"use client";

import { MessageSquare, User } from "lucide-react";
import Link from "next/link";
import { LikeButton } from "@/components/community/like-button";
import { formatRelativeTime, type Post } from "@/lib/forum-api";

type PostCardProps = {
  post: Post;
  onLike?: () => void;
  liking?: boolean;
};

export function PostCard({ post, onLike, liking }: PostCardProps) {
  return (
    <article className="group px-4 py-4 transition-colors sm:px-5 sm:py-4 sm:hover:bg-muted/20">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted/40 sm:size-9">
          {post.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.authorAvatar} alt={post.authorName} className="size-full object-cover" />
          ) : (
            <User className="size-3.5 sm:size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
            <span className="max-w-[10rem] truncate font-medium text-foreground/90 sm:max-w-none">{post.authorName}</span>
            <span>·</span>
            <span>{formatRelativeTime(post.createdAt)}</span>
          </div>
          <Link href={`/community/post?id=${encodeURIComponent(post.id)}`} className="mt-1 block">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-5 text-foreground transition-colors group-hover:text-primary sm:text-base sm:leading-6">
              {post.title}
            </h3>
          </Link>
          <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-[13px] leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            {post.content}
          </p>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
              <MessageSquare className="size-3" />
              <span>{post.replyCount} 条回复</span>
            </div>
            <LikeButton
              liked={post.isLikedByMe}
              count={post.likeCount}
              onClick={onLike}
              disabled={liking}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
