"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileBottomSheetContent } from "@/components/ui/mobile-bottom-sheet-content";
import {
  Activity,
  Bot,
  Clock3,
  Filter,
  Globe,
  Hash,
  MessageSquare,
  PanelRightOpen,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatHistoryResponse, ChatMessage, SessionItem, SessionListResponse } from "@/lib/openclaw/chat-types";

type SessionBoardStatus = "active" | "recent" | "idle";
type SessionBoardKind = "main" | "subagent" | "cron" | "group" | "direct" | "other";

type SessionBoardRow = {
  key: string;
  title: string;
  preview: string;
  agentId: string;
  updatedAt: number;
  status: SessionBoardStatus;
  kind: SessionBoardKind;
  channelLabel: string | null;
  modelLabel: string | null;
  searchableText: string;
  raw: SessionItem;
};

type SessionInfo = SessionItem & {
  updatedAt?: number;
  updatedAtMs?: number;
  createdAt?: number;
  timestamp?: number;
  kind?: string;
  channel?: string;
  model?: string;
  modelProvider?: string;
  lastMessagePreview?: string;
  derivedTitle?: string;
  title?: string;
  displayName?: string;
};

const ACTIVE_WINDOW_MS = 60_000;
const RECENT_WINDOW_MS = 10 * 60_000;

function toTimestamp(session: SessionInfo): number {
  const value = session.updatedAtMs || session.updatedAt || session.createdAt || session.timestamp || 0;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function relativeTime(timestamp: number) {
  if (!timestamp) return "未知";
  const diff = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
}

function resolveStatus(updatedAt: number): SessionBoardStatus {
  const age = Math.max(0, Date.now() - updatedAt);
  if (age <= ACTIVE_WINDOW_MS) return "active";
  if (age <= RECENT_WINDOW_MS) return "recent";
  return "idle";
}

function resolveKind(session: SessionInfo): SessionBoardKind {
  if (/^agent:[^:]+:main$/.test(session.key)) return "main";
  if (session.key.includes(":subagent:")) return "subagent";
  if (session.key.includes(":cron:") || session.label?.startsWith("[Cron]") || session.derivedTitle?.startsWith("[Cron]")) return "cron";
  if (session.kind === "group") return "group";
  if (session.kind === "direct") return "direct";
  return "other";
}

function normalizeChannelLabel(channel?: string): string | null {
  const normalized = channel?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "feishu" || normalized === "lark") return "Feishu";
  if (normalized === "whatsapp") return "WhatsApp";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function resolveModelLabel(session: SessionInfo): string | null {
  const provider = typeof session.modelProvider === "string" ? session.modelProvider.trim() : "";
  const model = typeof session.model === "string" ? session.model.trim() : "";
  if (provider && model) return `${provider}/${model}`;
  if (model) return model;
  return null;
}

function getAgentId(key: string) {
  if (key.startsWith("agent:")) return key.split(":")[1] || "unknown";
  return "main";
}

function getSessionTitle(session: SessionInfo) {
  return session.displayName || session.derivedTitle || session.title || session.label || session.key.split(":").pop() || session.key;
}

function softWrapText(text: string) {
  return text.replace(/([/\\_.:?=&-])/g, "$1\u200b");
}

function getMessageText(message: ChatMessage) {
  if (typeof message.text === "string" && message.text.trim()) return message.text.trim();
  if (typeof message.content === "string" && message.content.trim()) return message.content.trim();
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join(" ")
      .trim();
  }
  return "";
}

function buildRows(sessions: SessionInfo[]): SessionBoardRow[] {
  return sessions
    .map((session) => {
      const updatedAt = toTimestamp(session);
      const title = getSessionTitle(session);
      const preview = softWrapText((session.lastMessagePreview || "").replace(/\s+/g, " ").trim());
      const channelLabel = normalizeChannelLabel(session.channel);
      const modelLabel = resolveModelLabel(session);
      const kind = resolveKind(session);
      const status = resolveStatus(updatedAt);
      const searchableText = [
        session.key,
        title,
        preview,
        session.label,
        session.displayName,
        session.derivedTitle,
        session.channel,
        modelLabel,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join("\n")
        .toLowerCase();

      return {
        key: session.key,
        title,
        preview,
        agentId: getAgentId(session.key),
        updatedAt,
        status,
        kind,
        channelLabel,
        modelLabel,
        searchableText,
        raw: session,
      } satisfies SessionBoardRow;
    })
    .sort((a, b) => {
      const score = { active: 3, recent: 2, idle: 1 };
      if (score[a.status] !== score[b.status]) return score[b.status] - score[a.status];
      return b.updatedAt - a.updatedAt;
    });
}

function statusLabel(status: SessionBoardStatus) {
  if (status === "active") return "活跃";
  if (status === "recent") return "近期";
  return "空闲";
}

function kindLabel(kind: SessionBoardKind) {
  if (kind === "main") return "主会话";
  if (kind === "subagent") return "子 Agent";
  if (kind === "cron") return "定时任务";
  if (kind === "group") return "群聊";
  if (kind === "direct") return "私聊";
  return "其他";
}

function statusTone(status: SessionBoardStatus) {
  if (status === "active") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (status === "recent") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  return "bg-muted/30 text-muted-foreground border-border/50";
}

function agentColor(agentId: string) {
  const hash = agentId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return `hsl(${hash % 360} 70% 48%)`;
}

export default function SessionsPage() {
  const router = useRouter();
  const { connected, client } = useGateway();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SessionBoardStatus>("all");
  const [kindFilter, setKindFilter] = useState<"all" | SessionBoardKind>("all");
  const [view, setView] = useState<"board" | "agents">("board");
  const [selectedKey, setSelectedKey] = useState("");
  const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!connected || !client) return;
    setLoading(true);
    try {
      const res = await client.request<SessionListResponse>("sessions.list", {
        limit: 200,
        includeGlobal: true,
        includeUnknown: true,
        includeLastMessage: true,
        includeDerivedTitles: true,
      });
      const nextSessions = (res.sessions || []) as SessionInfo[];
      setSessions(nextSessions);
      setSelectedKey((current) => (current && nextSessions.some((item) => item.key === current) ? current : nextSessions[0]?.key || ""));
    } catch (error) {
      toast({
        title: "加载会话看板失败",
        description: error instanceof Error ? error.message : "无法读取 sessions.list",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [client, connected, toast]);

  const loadHistory = useCallback(async (sessionKey: string) => {
    if (!client || !connected || !sessionKey) return;
    setHistoryLoading(true);
    try {
      const res = await client.request<ChatHistoryResponse>("chat.history", { sessionKey, limit: 12 });
      setHistoryMessages(res.messages || []);
    } catch (error) {
      setHistoryMessages([]);
      toast({
        title: "读取会话历史失败",
        description: error instanceof Error ? error.message : "无法查看该会话最近消息",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [client, connected, toast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedKey) {
      setHistoryMessages([]);
      return;
    }
    loadHistory(selectedKey);
  }, [loadHistory, selectedKey]);

  const rows = useMemo(() => buildRows(sessions), [sessions]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (!keyword) return true;
      return row.searchableText.includes(keyword);
    });
  }, [rows, search, statusFilter, kindFilter]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      { active: 0, recent: 0, idle: 0 },
    );
  }, [filteredRows]);

  const groupedByAgent = useMemo(() => {
    return filteredRows.reduce<Record<string, SessionBoardRow[]>>((acc, row) => {
      if (!acc[row.agentId]) acc[row.agentId] = [];
      acc[row.agentId].push(row);
      return acc;
    }, {});
  }, [filteredRows]);

  const selectedRow = useMemo(() => filteredRows.find((row) => row.key === selectedKey) || rows.find((row) => row.key === selectedKey) || null, [filteredRows, rows, selectedKey]);

  const openInChat = useCallback((sessionKey: string) => {
    const raw = localStorage.getItem("openclaw.control.settings.v1");
    const settings = raw ? JSON.parse(raw) : {};
    settings.sessionKey = sessionKey;
    localStorage.setItem("openclaw.control.settings.v1", JSON.stringify(settings));
    setMobileDetailOpen(false);
    router.push("/chat");
  }, [router]);

  const handleSelectSession = useCallback((sessionKey: string) => {
    setSelectedKey(sessionKey);
    if (isMobile) setMobileDetailOpen(true);
  }, [isMobile]);

  return (
    <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden bg-muted/5 p-3 sm:p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4 overflow-x-hidden pb-8 sm:space-y-6 sm:pb-12">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
              <MessageSquare className="size-3.5" /> Sessions Board
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">会话看板</h1>
              <p className="text-sm text-muted-foreground">
                参考 clawket 的会话控制台，把 session 从“纯列表”升级成“可筛选、可预览、可跳转”的运行看板。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
            <Button variant="outline" onClick={loadSessions} disabled={loading} className="min-w-0 rounded-2xl border-border/50 px-2 sm:w-auto">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              刷新
            </Button>
            {selectedRow && (
              <Button onClick={() => openInChat(selectedRow.key)} className="min-w-0 rounded-2xl px-2 sm:w-auto">
                <PanelRightOpen className="size-4" />
                打开会话
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 md:grid-cols-3">
          <StatCard icon={Activity} label="活跃会话" value={String(summary.active)} tone="emerald" />
          <StatCard icon={Clock3} label="近期会话" value={String(summary.recent)} tone="amber" />
          <StatCard icon={Sparkles} label="空闲会话" value={String(summary.idle)} tone="blue" />
        </div>

        <Card className="max-w-full overflow-hidden border-border/50 bg-background/80 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索 session key / 标题 / 预览 / channel / model"
                className="pl-9"
              />
            </div>
            <Tabs value={view} onValueChange={(value) => setView(value as "board" | "agents")} className="w-full md:w-auto">
              <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-border/50 bg-muted/20 p-1 md:w-auto md:justify-center">
                <TabsTrigger value="board" className="rounded-xl">会话</TabsTrigger>
                <TabsTrigger value="agents" className="rounded-xl">按 Agent</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
          <CardContent className="space-y-3 overflow-hidden border-t border-border/40 pt-3 sm:pt-4">
            <div className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1">
              <FilterChip icon={Filter} active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>全部状态</FilterChip>
              <FilterChip active={statusFilter === "active"} onClick={() => setStatusFilter("active")}>活跃</FilterChip>
              <FilterChip active={statusFilter === "recent"} onClick={() => setStatusFilter("recent")}>近期</FilterChip>
              <FilterChip active={statusFilter === "idle"} onClick={() => setStatusFilter("idle")}>空闲</FilterChip>
            </div>
            <div className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1">
              <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>全部类型</FilterChip>
              <FilterChip active={kindFilter === "main"} onClick={() => setKindFilter("main")}>主会话</FilterChip>
              <FilterChip active={kindFilter === "subagent"} onClick={() => setKindFilter("subagent")}>子 Agent</FilterChip>
              <FilterChip active={kindFilter === "cron"} onClick={() => setKindFilter("cron")}>定时任务</FilterChip>
              <FilterChip active={kindFilter === "direct"} onClick={() => setKindFilter("direct")}>私聊</FilterChip>
              <FilterChip active={kindFilter === "group"} onClick={() => setKindFilter("group")}>群聊</FilterChip>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="min-w-0 space-y-4">
            {view === "board" ? (
              filteredRows.length === 0 && !loading ? (
                <EmptyState />
              ) : (
                filteredRows.map((row) => (
                  <SessionCard
                    key={row.key}
                    row={row}
                    selected={row.key === selectedKey}
                    onClick={() => handleSelectSession(row.key)}
                  />
                ))
              )
            ) : Object.keys(groupedByAgent).length === 0 && !loading ? (
              <EmptyState />
            ) : (
              Object.entries(groupedByAgent).map(([agentId, agentSessions]) => (
                <Card key={agentId} className="border-border/50 bg-background/80 shadow-sm">
                  <CardHeader className="border-b border-border/40 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="size-3 rounded-full" style={{ backgroundColor: agentColor(agentId) }} />
                      <CardTitle className="text-lg">{agentId}</CardTitle>
                      <Badge variant="outline">{agentSessions.length} 个会话</Badge>
                    </div>
                    <CardDescription>按 Agent 归组查看会话，方便切换到主会话、子会话或协作分支。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    {agentSessions.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => handleSelectSession(row.key)}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                          row.key === selectedKey ? "border-primary/30 bg-primary/5 shadow-sm" : "border-border/50 hover:bg-muted/10",
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{row.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{row.preview || "暂无预览"}</p>
                          </div>
                          <Badge variant="outline" className={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <Card className="hidden max-w-full border-border/50 bg-background/80 shadow-sm xl:block">
            <CardHeader className="border-b border-border/40">
              <CardTitle className="text-lg">会话详情</CardTitle>
              <CardDescription>查看当前选中会话的状态、元信息和最近消息预览。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <SessionDetailPanel
                row={selectedRow}
                historyMessages={historyMessages}
                historyLoading={historyLoading}
                loadHistory={loadHistory}
                openInChat={openInChat}
              />
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={mobileDetailOpen && !!selectedRow} onOpenChange={setMobileDetailOpen}>
        <DialogContent className="top-auto bottom-0 left-0 right-0 z-50 flex max-h-[85vh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-t-[2rem] rounded-b-none border-border/50 p-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:left-[50%] sm:right-auto sm:top-[50%] sm:bottom-auto sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] xl:hidden">
          <DialogHeader className="border-b border-border/40 px-5 pb-4 pt-5 text-left">
            <div className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>Tap a session card on mobile to open its details in a bottom sheet.</DialogDescription>
          </DialogHeader>
          <MobileBottomSheetContent className="space-y-6 px-5 py-5">
            <SessionDetailPanel
              row={selectedRow}
              historyMessages={historyMessages}
              historyLoading={historyLoading}
              loadHistory={loadHistory}
              openInChat={openInChat}
            />
          </MobileBottomSheetContent>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FilterChip({
  children,
  active,
  onClick,
  icon: Icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon?: typeof Filter;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
        active ? "border-primary/30 bg-primary/10 text-primary" : "border-border/50 bg-background hover:bg-muted/20",
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "blue";
}) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  }[tone];
  return (
    <Card className="border-border/50 bg-background/80 shadow-sm">
      <CardContent className="p-2.5 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:items-center sm:gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-bold tracking-[0.02em] text-muted-foreground sm:text-xs sm:tracking-[0.12em]">{label}</p>
            <p className="mt-1 text-xl font-black tracking-tight sm:mt-2 sm:text-2xl">{value}</p>
          </div>
          <div className={cn("flex size-8 items-center justify-center rounded-xl border shrink-0 sm:size-12 sm:rounded-2xl", toneClass)}>
            <Icon className="size-3.5 sm:size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionCard({
  row,
  selected,
  onClick,
}: {
  row: SessionBoardRow;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full max-w-full overflow-hidden rounded-3xl border bg-background/80 px-3.5 py-3 text-left shadow-sm transition-all sm:px-5 sm:py-4",
        selected ? "border-primary/30 bg-primary/5 shadow-md" : "border-border/50 hover:border-primary/20 hover:bg-muted/10",
      )}
    >
      <div className="min-w-0 max-w-full space-y-2.5">
        <div className="flex max-w-full flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn("px-2 py-0 text-[10px]", statusTone(row.status))}>{statusLabel(row.status)}</Badge>
          <Badge variant="secondary" className="px-2 py-0 text-[10px]">{kindLabel(row.kind)}</Badge>
          <Badge variant="outline" className="hidden px-2 py-0 text-[10px] sm:inline-flex"><Hash className="mr-1 size-3" /> {row.agentId}</Badge>
          {row.channelLabel && <Badge variant="outline" className="hidden px-2 py-0 text-[10px] sm:inline-flex">{row.channelLabel}</Badge>}
        </div>
        <div className="min-w-0 max-w-full space-y-1">
          <p className="max-w-full line-clamp-2 break-words text-[15px] font-bold leading-snug sm:text-base">{row.title}</p>
          <p className="block w-full max-w-full overflow-hidden whitespace-normal [overflow-wrap:anywhere] line-clamp-2 text-[13px] leading-5 text-muted-foreground sm:line-clamp-2 sm:text-sm">{row.preview || "暂无最近消息预览"}</p>
        </div>
        <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="shrink-0">{relativeTime(row.updatedAt)}</span>
          <span className="shrink-0 sm:hidden">#{row.agentId}</span>
          {row.channelLabel && <span className="shrink-0 sm:hidden">{row.channelLabel}</span>}
          {row.modelLabel && <span className="min-w-0 max-w-full truncate sm:max-w-40">{row.modelLabel}</span>}
        </div>
      </div>
    </button>
  );
}

function SessionDetailPanel({
  row,
  historyMessages,
  historyLoading,
  loadHistory,
  openInChat,
}: {
  row: SessionBoardRow | null;
  historyMessages: ChatMessage[];
  historyLoading: boolean;
  loadHistory: (sessionKey: string) => void;
  openInChat: (sessionKey: string) => void;
}) {
  if (!row) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-4 py-16 text-center text-sm text-muted-foreground">
        Select a session from the list first.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-black tracking-tight">{row.title}</h2>
            <p className="break-all font-mono text-xs text-muted-foreground">{row.key}</p>
          </div>
          <Badge variant="outline" className={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline"><Bot className="mr-1 size-3" /> {row.agentId}</Badge>
          <Badge variant="secondary">{kindLabel(row.kind)}</Badge>
          {row.channelLabel && <Badge variant="outline"><Globe className="mr-1 size-3" /> {row.channelLabel}</Badge>}
          {row.modelLabel && <Badge variant="outline">{row.modelLabel}</Badge>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailMetric label="Last Active" value={relativeTime(row.updatedAt)} />
        <DetailMetric label="Display Name" value={row.raw.displayName || row.raw.label || "Not set"} />
        <DetailMetric label="Token Input" value={String(row.raw.usage?.input || 0)} />
        <DetailMetric label="Token Output" value={String(row.raw.usage?.output || 0)} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Recent Messages</p>
            <p className="text-xs text-muted-foreground">Quickly inspect what this session was doing most recently.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadHistory(row.key)} disabled={historyLoading} className="rounded-xl">
            <RefreshCw className={cn("size-4", historyLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <div className="space-y-2">
          {historyMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
              {historyLoading ? "Loading history..." : "No history preview yet."}
            </div>
          ) : (
            historyMessages.map((message, index) => {
              const text = getMessageText(message) || "(non-text message)";
              const role = message.role || "assistant";
              return (
                <div key={`${row.key}_${message.id || index}`} className="rounded-2xl border border-border/50 bg-muted/10 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant={role === "user" ? "secondary" : role === "tool" ? "warning" : "outline"}>
                      {role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(
                        typeof message.createdAt === "number"
                          ? message.createdAt
                          : typeof message.timestamp === "number"
                            ? message.timestamp
                            : 0,
                      )}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{text}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Button className="w-full rounded-2xl" onClick={() => openInChat(row.key)}>
        <MessageSquare className="size-4" />
        Open This Session In Chat
      </Button>
    </>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/10 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-border/50 bg-background/60 px-6 py-16 text-center">
      <MessageSquare className="mx-auto mb-4 size-12 text-muted-foreground/20" />
      <p className="text-base font-semibold">没有匹配的会话</p>
      <p className="mt-2 text-sm text-muted-foreground">换个关键字、状态或类型筛选试试看。</p>
    </div>
  );
}
