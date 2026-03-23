"use client";

import { Loader2, MessageSquare, Trash2, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LikeButton } from "@/components/community/like-button";
import { formatRelativeTime, type Reply } from "@/lib/forum-api";

type ReplyListProps = {
  replies: Reply[];
  onLike?: (replyId: string) => void;
  onDelete?: (replyId: string) => void;
  likingReplyId?: string | null;
  deletingReplyId?: string | null;
  isAdmin?: boolean;
};

export function ReplyList({ replies, onLike, onDelete, likingReplyId, deletingReplyId, isAdmin = false }: ReplyListProps) {
  if (!replies.length) {
    return (
      <Card className="border-border/50 bg-background/70">
        <CardContent className="flex min-h-[140px] flex-col items-center justify-center px-4 text-center sm:min-h-[180px]">
          <div className="flex size-11 items-center justify-center rounded-full border border-border/50 bg-muted/30 sm:size-14">
            <MessageSquare className="size-5 text-muted-foreground/60 sm:size-6" />
          </div>
          <h3 className="mt-3 text-base font-bold sm:mt-4 sm:text-lg">还没有回复</h3>
          <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">成为第一个参与讨论的人。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {replies.map((reply) => (
        <div key={reply.id} className="flex gap-2.5 sm:gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted/40 sm:size-9">
            {reply.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reply.authorAvatar} alt={reply.authorName} className="size-full object-cover" />
            ) : (
              <User className="size-3.5 sm:size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
              <span className="font-semibold text-foreground/90">{reply.authorName}</span>
              <span>·</span>
              <span>{formatRelativeTime(reply.createdAt)}</span>
            </div>
            <div className="max-w-[min(100%,34rem)] rounded-[1.2rem] rounded-tl-sm border border-border/50 bg-background px-3.5 py-2.5 text-[13px] leading-6 text-foreground/90 shadow-sm sm:px-4 sm:py-3 sm:text-sm sm:leading-7">
              <p className="whitespace-pre-wrap">{reply.content}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-1">
              <LikeButton
                liked={reply.isLikedByMe}
                count={reply.likeCount}
                onClick={onLike ? () => onLike(reply.id) : undefined}
                disabled={likingReplyId === reply.id}
              />
              {isAdmin && onDelete ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full gap-1.5 px-3 text-xs sm:gap-2 sm:text-sm"
                  onClick={() => onDelete(reply.id)}
                  disabled={deletingReplyId === reply.id}
                >
                  {deletingReplyId === reply.id ? (
                    <Loader2 className="size-3.5 animate-spin sm:size-4" />
                  ) : (
                    <Trash2 className="size-3.5 sm:size-4" />
                  )}
                  删除回复
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
