"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageSquare, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LikeButton } from "@/components/community/like-button";
import { ReplyEditor } from "@/components/community/reply-editor";
import { ReplyList } from "@/components/community/reply-list";
import { useForumActions, usePost } from "@/hooks/use-forum";
import { useProfile } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/forum-api";
import { Suspense, useMemo, useState } from "react";

function CommunityPostPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useProfile();
  const postId = searchParams.get("id");
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [likingPost, setLikingPost] = useState(false);
  const [likingReplyId, setLikingReplyId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);

  const viewer = useMemo(
    () => ({
      id: profile.nickname || "guest",
      name: profile.nickname || "访客",
      avatar: profile.avatar,
    }),
    [profile.avatar, profile.nickname]
  );

  const isAdmin = viewer.name === "NanSsye";

  const { post, replies, loading, error, setPost, setReplies } = usePost(postId || null, viewer.id);
  const { submitReply, likePost, likeReply, removePost, removeReply } = useForumActions(viewer);

  const handleReply = async () => {
    const content = replyContent.trim();
    if (!postId) return;
    if (content.length < 2) {
      toast({ title: "回复太短", description: "回复内容至少需要 2 个字。", variant: "destructive" });
      return;
    }

    setSubmittingReply(true);
    try {
      const created = await submitReply(postId, { content });
      setReplies((prev) => [...prev, created]);
      setPost((prev) =>
        prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev
      );
      setReplyContent("");
      toast({ title: "回复成功", description: "你的回复已添加到帖子下方。" });
    } catch (err) {
      toast({
        title: "回复失败",
        description: err instanceof Error ? err.message : "无法发送回复",
        variant: "destructive",
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  const handlePostLike = async () => {
    if (!post) return;
    setLikingPost(true);
    try {
      const result = await likePost(post.id);
      setPost((prev) =>
        prev ? { ...prev, isLikedByMe: result.liked, likeCount: result.likeCount } : prev
      );
    } catch (err) {
      toast({
        title: "操作失败",
        description: err instanceof Error ? err.message : "点赞失败",
        variant: "destructive",
      });
    } finally {
      setLikingPost(false);
    }
  };

  const handleReplyLike = async (replyId: string) => {
    setLikingReplyId(replyId);
    try {
      const result = await likeReply(replyId);
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === replyId
            ? { ...reply, isLikedByMe: result.liked, likeCount: result.likeCount }
            : reply
        )
      );
    } catch (err) {
      toast({
        title: "操作失败",
        description: err instanceof Error ? err.message : "点赞失败",
        variant: "destructive",
      });
    } finally {
      setLikingReplyId(null);
    }
  };

  const handleDeletePost = async () => {
    if (!post || !confirm("确定要删除这个帖子及其所有回复吗？此操作不可恢复。")) return;
    try {
      await removePost(post.id, "openclaw-admin");
      toast({ title: "删除成功", description: "帖子已删除" });
      router.push("/community");
    } catch (err) {
      toast({
        title: "删除失败",
        description: err instanceof Error ? err.message : "无法删除",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm("确定要删除这条回复吗？此操作不可恢复。")) return;
    setDeletingReplyId(replyId);
    try {
      await removeReply(replyId, "openclaw-admin");
      setReplies((prev) => prev.filter((reply) => reply.id !== replyId));
      setPost((prev) =>
        prev ? { ...prev, replyCount: Math.max(0, prev.replyCount - 1) } : prev
      );
      toast({ title: "删除成功", description: "回复已删除" });
    } catch (err) {
      toast({
        title: "删除失败",
        description: err instanceof Error ? err.message : "无法删除回复",
        variant: "destructive",
      });
    } finally {
      setDeletingReplyId(null);
    }
  };

  if (!postId) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-4">
        <Button variant="ghost" className="rounded-full" onClick={() => router.push("/community")}>
          <ArrowLeft className="size-4" />
          返回社区
        </Button>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            缺少帖子 ID。
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8">
        <Card className="border-border/50 bg-background/70">
          <CardContent className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span>正在加载帖子详情...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-4">
        <Button variant="ghost" className="rounded-full" onClick={() => router.push("/community")}>
          <ArrowLeft className="size-4" />
          返回社区
        </Button>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            {error || "帖子不存在"}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-5 md:space-y-8">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button asChild variant="ghost" size="sm" className="rounded-full px-3 text-xs sm:text-sm">
          <Link href="/community">
            <ArrowLeft className="size-3.5 sm:size-4" />
            返回社区
          </Link>
        </Button>
        <div className="flex-1" />
        {isAdmin && (
          <Button variant="destructive" size="sm" className="rounded-full gap-1.5 px-3 text-xs sm:gap-2 sm:text-sm" onClick={handleDeletePost}>
            <Trash2 className="size-3.5 sm:size-4" />
            删除帖子
          </Button>
        )}
      </div>

      <section className="rounded-2xl border border-border/50 bg-background/70 px-4 py-4 shadow-sm sm:px-5 sm:py-5 md:px-6 md:py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
              <div className="flex size-7 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted/40 sm:size-8">
                {post.authorAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.authorAvatar} alt={post.authorName} className="size-full object-cover" />
                ) : (
                  <User className="size-3.5" />
                )}
              </div>
              <span className="font-medium text-foreground">{post.authorName}</span>
              <span>·</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {post.replyCount} 条回复</span>
            </div>
            <h1 className="mt-2 text-lg font-black leading-6 text-foreground sm:text-xl sm:leading-7 md:text-2xl md:leading-8">
              {post.title}
            </h1>
          </div>
          <LikeButton liked={post.isLikedByMe} count={post.likeCount} onClick={handlePostLike} disabled={likingPost} />
        </div>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/90 md:text-base md:leading-8">
          {post.content}
        </div>
      </section>

      <ReplyEditor
        value={replyContent}
        onChange={setReplyContent}
        onSubmit={handleReply}
        submitting={submittingReply}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">全部回复</h2>
            <p className="mt-1 text-sm text-muted-foreground">共 {replies.length} 条交流内容</p>
          </div>
        </div>
        <ReplyList
          replies={replies}
          onLike={handleReplyLike}
          onDelete={handleDeleteReply}
          likingReplyId={likingReplyId}
          deletingReplyId={deletingReplyId}
          isAdmin={isAdmin}
        />
      </section>
    </div>
  );
}

export default function CommunityPostPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8">
          <Card className="border-border/50 bg-background/70">
            <CardContent className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span>正在加载帖子详情...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <CommunityPostPageContent />
    </Suspense>
  );
}
