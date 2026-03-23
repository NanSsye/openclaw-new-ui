"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/use-profile";
import { useForumActions, usePosts } from "@/hooks/use-forum";
import { PostList } from "@/components/community/post-list";

export default function CommunityPage() {
  const { toast } = useToast();
  const { profile } = useProfile();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "hot">("latest");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });

  const viewer = useMemo(
    () => ({
      id: profile.nickname || "guest",
      name: profile.nickname || "访客",
      avatar: profile.avatar,
    }),
    [profile.avatar, profile.nickname]
  );

  const { items, loading, error, refresh, setItems } = usePosts(
    {
      q: query.trim() || undefined,
      sort,
      page: 1,
      pageSize: 20,
    },
    viewer.id
  );
  const { submitPost, likePost } = useForumActions(viewer);

  const handleCreatePost = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (title.length < 2) {
      toast({ title: "标题太短", description: "帖子标题至少需要 2 个字。", variant: "destructive" });
      return;
    }
    if (content.length < 5) {
      toast({ title: "内容太短", description: "帖子内容至少需要 5 个字。", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const created = await submitPost({ title, content });
      setItems((prev) => [created, ...prev]);
      setCreateOpen(false);
      setForm({ title: "", content: "" });
      toast({ title: "发布成功", description: "你的帖子已经出现在社区列表中。" });
    } catch (err) {
      toast({
        title: "发布失败",
        description: err instanceof Error ? err.message : "无法发布帖子",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    setLikingPostId(postId);
    try {
      const result = await likePost(postId);
      setItems((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, isLikedByMe: result.liked, likeCount: result.likeCount }
            : post
        )
      );
    } catch (err) {
      toast({
        title: "操作失败",
        description: err instanceof Error ? err.message : "点赞失败",
        variant: "destructive",
      });
    } finally {
      setLikingPostId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 sm:p-4 md:p-8 space-y-3.5 sm:space-y-4 md:space-y-7">
      <section className="rounded-xl border border-border/40 bg-background/60 p-3.5 sm:p-4 md:rounded-2xl md:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2 sm:space-y-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary sm:gap-2 sm:px-2.5 sm:text-[11px]">
              <Sparkles className="size-3" />
              社区交流
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight sm:text-2xl md:text-3xl">用户交流社区</h1>
              <p className="mt-1 max-w-2xl text-[11px] leading-5 text-muted-foreground sm:text-xs md:mt-1.5 md:text-sm md:leading-6">
                在这里分享使用经验、提出问题、交流插件玩法与部署心得。
              </p>
            </div>
          </div>
          <Button size="sm" className="h-9 self-start rounded-full px-4 text-sm lg:self-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            发布帖子
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border/40 bg-background/60 p-2.5 sm:p-3 md:rounded-2xl">
        <div className="flex flex-col gap-2.5 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索帖子标题或内容"
              className="h-9 border-border/50 bg-background pl-9 text-sm sm:h-10 sm:pl-10"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Tabs value={sort} onValueChange={(value) => setSort(value as "latest" | "hot") }>
              <TabsList className="mb-0 h-9 w-auto rounded-full border border-border/50 bg-background p-1">
                <TabsTrigger value="latest" className="h-7 rounded-full px-3 text-xs sm:px-4 sm:text-sm">最新</TabsTrigger>
                <TabsTrigger value="hot" className="h-7 rounded-full px-3 text-xs sm:px-4 sm:text-sm">热门</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" variant="outline" className="h-9 rounded-full px-3 text-xs sm:text-sm" onClick={refresh}>
              <RefreshCw className="size-3.5 sm:size-4" />
              刷新
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive md:rounded-3xl md:p-6">
          {error}
        </div>
      ) : null}

      <PostList
        posts={items}
        loading={loading}
        onLike={handleToggleLike}
        likingPostId={likingPostId}
        emptyTitle={query ? "没有找到匹配的帖子" : "社区还没有内容"}
        emptyDescription={query ? "换个关键词试试，或者发布一个新话题。" : "成为第一个发帖的人，开启这片社区的第一次交流。"}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl rounded-3xl border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">发布新帖子</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">标题</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="例如：如何把插件市场接到我的后端？"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">正文</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="说说你的问题、经验或想法..."
                rows={8}
                className="flex w-full rounded-3xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setCreateOpen(false)} disabled={creating}>
              取消
            </Button>
            <Button className="rounded-full" onClick={handleCreatePost} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
