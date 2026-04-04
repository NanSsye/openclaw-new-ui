"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Bot, CheckCircle2, ChevronDown, Clock3, FolderArchive, LoaderCircle, RefreshCw, Send, Sparkles, Trash2, Users, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CollabDispatchTemplate, CollabRoom, CollabSessionRef, CollabWorkerState } from "@/lib/openclaw/collab-types";

const STATUS_LABELS: Record<CollabRoom["status"], string> = { draft: "草稿", running: "运行中", waiting: "等待主控汇总", done: "已完成", error: "异常" };
const WORKER_STATUS_LABELS: Record<CollabWorkerState["status"], string> = {
  pending: "待派发",
  queued: "已排队",
  running: "执行中",
  reported: "已回报",
  blocked: "有阻塞",
};


function getWorkerStatusStyles(status: CollabWorkerState["status"]) {
  if (status === "reported") return {
    badge: "border-emerald-500/20 bg-emerald-500/5 text-emerald-600",
    iconWrap: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    card: "border-emerald-500/15 bg-emerald-500/[0.03]",
  };
  if (status === "blocked") return {
    badge: "border-red-500/20 bg-red-500/5 text-red-600",
    iconWrap: "border-red-500/20 bg-red-500/10 text-red-600",
    card: "border-red-500/15 bg-red-500/[0.03]",
  };
  if (status === "running") return {
    badge: "border-blue-500/20 bg-blue-500/5 text-blue-600",
    iconWrap: "border-blue-500/20 bg-blue-500/10 text-blue-600",
    card: "border-blue-500/15 bg-blue-500/[0.03]",
  };
  if (status === "queued") return {
    badge: "border-amber-500/20 bg-amber-500/5 text-amber-600",
    iconWrap: "border-amber-500/20 bg-amber-500/10 text-amber-600",
    card: "border-amber-500/15 bg-amber-500/[0.03]",
  };
  return {
    badge: "border-border/50 bg-background/80 text-muted-foreground",
    iconWrap: "border-border/50 bg-background/80 text-muted-foreground",
    card: "border-border/50 bg-background/70",
  };
}

function getSourceLabel(source: CollabSessionRef["source"]) {
  if (source === "root") return "主控";
  if (source === "worker") return "Worker";
  if (source === "subagent") return "子会话";
  if (source === "summary") return "汇总";
  return "手动";
}

function WorkerStatusIcon({ status }: { status: CollabWorkerState["status"] }) {
  if (status === "reported") return <CheckCircle2 className="size-3.5 text-emerald-500" />;
  if (status === "blocked") return <AlertTriangle className="size-3.5 text-red-500" />;
  if (status === "running") return <LoaderCircle className="size-3.5 text-blue-500 animate-spin" />;
  return <Clock3 className="size-3.5 text-muted-foreground" />;
}

export function CollabAgentPanel({
  room,
  sessionRefs,
  workerStates,
  dispatchTemplates,
  loading,
  dispatching,
  summarizing,
  onRefresh,
  onDispatch,
  onDispatchTemplate,
  onRequestSummary,
  onSendToOwner,
  onClearHistory,
  onArchiveRoom,
  onRestoreRoom,
}: {
  room: CollabRoom | null;
  sessionRefs: CollabSessionRef[];
  workerStates: CollabWorkerState[];
  dispatchTemplates: CollabDispatchTemplate[];
  loading: boolean;
  dispatching: boolean;
  summarizing: boolean;
  onRefresh: () => void;
  onDispatch: () => void;
  onDispatchTemplate: (templateId: string) => void;
  onRequestSummary: () => void;
  onSendToOwner: (message: string) => Promise<boolean>;
  onClearHistory: () => void;
  onArchiveRoom: () => void;
  onRestoreRoom: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sections, setSections] = useState({ actions: true, templates: true, workers: true, sessions: false });
  const workerSessions = useMemo(() => sessionRefs.filter((ref) => ref.source === "worker" || ref.source === "subagent"), [sessionRefs]);

  const toggleSection = (key: keyof typeof sections) => setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!room) {
    return <Card className="rounded-[26px] border-border/50 bg-background/85 backdrop-blur-xl shadow-sm min-h-[420px] flex items-center justify-center p-8 text-center text-muted-foreground">选择一个协作房间后，这里会显示主控 / Worker 状态和操作按钮。</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[26px] overflow-hidden border-border/50 bg-background/85 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-background flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black tracking-tight">协作控制台</h2>
            <p className="text-xs text-muted-foreground mt-1">主控先收任务，再派发给 2/3/4，最后统一回报给你。</p>
          </div>
          <Badge variant="outline" className="rounded-full bg-background/80 shadow-sm">{STATUS_LABELS[room.status]}</Badge>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-[24px] border border-border/50 bg-background/70 p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold"><Bot className="size-4 text-primary" /> 主控：{room.ownerAgentId}</div>
            <div className="inline-flex w-fit rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground break-all">Root Session: {room.rootSessionKey}</div>
            <div className="text-xs leading-relaxed text-muted-foreground">{room.task}</div>
          </div>

          <div className="rounded-[24px] border border-border/50 bg-background/70 shadow-sm overflow-hidden xl:border-none xl:bg-transparent xl:shadow-none">
            <button type="button" onClick={() => toggleSection("actions")} className="xl:hidden w-full flex items-center justify-between px-4 py-3 text-left">
              <span className="text-sm font-bold">快捷操作</span>
              <ChevronDown className={cn("size-4 transition-transform", sections.actions && "rotate-180")} />
            </button>
            <div className={cn("space-y-4 p-4 pt-0 xl:p-0 xl:pt-0", !sections.actions && "hidden xl:block")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={onRefresh} variant="outline" className="rounded-full gap-2 shadow-sm bg-background/80 border-border/50 hover:scale-[1.01] transition-all" disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> 刷新房间</Button>
                <Button onClick={onDispatch} className="rounded-full gap-2 shadow-sm hover:scale-[1.01] transition-all" disabled={dispatching || room.workerAgentIds.length === 0}><Users className="size-4" /> {dispatching ? "派发中..." : "尝试派发 Worker"}</Button>
                {room.archivedAt ? (
                  <Button onClick={onRestoreRoom} variant="outline" className="rounded-full gap-2 shadow-sm bg-background/80 border-border/50 hover:scale-[1.01] transition-all"><ArchiveRestore className="size-4" /> 恢复到进行中</Button>
                ) : (
                  <Button onClick={onArchiveRoom} variant="outline" className="rounded-full gap-2 shadow-sm bg-background/80 border-border/50 hover:scale-[1.01] transition-all"><FolderArchive className="size-4" /> 归档当前任务</Button>
                )}
                <Button onClick={onClearHistory} variant="outline" className="rounded-full gap-2 shadow-sm bg-background/80 border-border/50 hover:scale-[1.01] transition-all text-muted-foreground hover:text-destructive" disabled={loading && dispatching}><Trash2 className="size-4" /> 清空本地历史快照</Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-[24px] border border-border/50 bg-background/70 p-4 shadow-sm overflow-hidden">
            <button type="button" onClick={() => toggleSection("templates")} className="xl:hidden -m-4 mb-0 w-[calc(100%+2rem)] flex items-center justify-between px-4 py-3 text-left">
              <span className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-primary" /> 一键分工模板</span>
              <ChevronDown className={cn("size-4 transition-transform", sections.templates && "rotate-180")} />
            </button>
            <div className={cn("space-y-3", !sections.templates && "hidden xl:block")}>
              <div className="hidden xl:flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-primary" /> 一键分工模板</div>
              <div className="grid gap-2">
                {dispatchTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onDispatchTemplate(template.id)}
                    disabled={dispatching || room.workerAgentIds.length === 0}
                    className="text-left rounded-[1.5rem] border border-border/50 bg-background/85 px-3.5 py-3.5 hover:bg-muted/20 hover:scale-[1.01] transition-all shadow-sm disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-xl border border-primary/15 bg-primary/5 flex items-center justify-center text-primary shadow-sm">
                            <Sparkles className="size-3.5" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold leading-none">{template.label}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">任务模板</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-3 leading-relaxed">{template.description}</div>
                      </div>
                      <Badge variant="outline" className="rounded-full bg-background/80 shadow-sm">派发</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={onRequestSummary} variant="secondary" className="w-full rounded-full gap-2 shadow-sm bg-secondary hover:scale-[1.01] transition-all" disabled={summarizing}><Sparkles className="size-4" /> {summarizing ? "请求中..." : "请求主控汇总"}</Button>

          <div className="space-y-3 rounded-[24px] border border-border/50 bg-background/70 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold"><Wand2 className="size-4 text-primary" /> 向主控发送补充指令</div>
            <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="例如：请你先派给 Agent2 看日志，Agent3 看配置，Agent4 看节点状态。" className="rounded-full border-border/50 bg-background/80 shadow-sm backdrop-blur-sm" />
            <Button onClick={async () => { const ok = await onSendToOwner(message); if (ok) setMessage(""); }} disabled={!message.trim()} className="w-full rounded-full gap-2 shadow-sm hover:scale-[1.01] transition-all"><Send className="size-4" /> 发送到主控会话</Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-[26px] overflow-hidden border-border/50 bg-background/85 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 bg-gradient-to-r from-muted/25 to-background xl:block hidden">
          <h3 className="text-sm font-black tracking-tight">Worker 状态</h3>
          <p className="text-xs text-muted-foreground mt-1">根据已发现的子会话与反馈自动推断当前执行状态。</p>
        </div>
        <button type="button" onClick={() => toggleSection("workers")} className="xl:hidden w-full flex items-center justify-between px-4 py-3 text-left border-b border-border/50 bg-gradient-to-r from-muted/25 to-background">
          <span className="text-sm font-black tracking-tight">Worker 状态</span>
          <ChevronDown className={cn("size-4 transition-transform", sections.workers && "rotate-180")} />
        </button>
        <div className={cn("p-4 space-y-3", !sections.workers && "hidden xl:block")}>
          {workerStates.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">当前房间没有配置 worker。</div>
          ) : workerStates.map((worker) => {
            const statusStyles = getWorkerStatusStyles(worker.status);
            return (
              <div key={worker.agentId} className={cn("rounded-[24px] border px-4 py-3.5 shadow-sm transition-all", statusStyles.card)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <div className={cn("size-8 rounded-xl border flex items-center justify-center shadow-sm", statusStyles.iconWrap)}>
                        <WorkerStatusIcon status={worker.status} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{worker.agentId}</div>
                        <div className="mt-1 inline-flex max-w-full items-center rounded-full border border-border/50 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
                          {worker.sessionKey || "尚未建立子会话"}
                        </div>
                      </div>
                    </div>
                    {worker.summary && <div className="mt-3 rounded-2xl border border-border/40 bg-background/80 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground shadow-sm line-clamp-3">{worker.summary}</div>}
                  </div>
                  <Badge variant="outline" className={cn("rounded-full shadow-sm", statusStyles.badge)}>{WORKER_STATUS_LABELS[worker.status]}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-[26px] overflow-hidden border-border/50 bg-background/85 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 bg-gradient-to-r from-muted/25 to-background xl:block hidden">
          <div className="flex items-center gap-2 text-sm font-black tracking-tight"><Archive className="size-4 text-primary" /> 参与会话 / 本地快照</div>
          <p className="text-xs text-muted-foreground mt-1">当前房间绑定的 root / worker / subagent session，本地已抓到的历史会保留，直到你手动删除。</p>
        </div>
        <button type="button" onClick={() => toggleSection("sessions")} className="xl:hidden w-full flex items-center justify-between px-4 py-3 text-left border-b border-border/50 bg-gradient-to-r from-muted/25 to-background">
          <span className="flex items-center gap-2 text-sm font-black tracking-tight"><Archive className="size-4 text-primary" /> 参与会话 / 本地快照</span>
          <ChevronDown className={cn("size-4 transition-transform", sections.sessions && "rotate-180")} />
        </button>
        <div className={cn("p-4 space-y-3", !sections.sessions && "hidden xl:block")}>
          {sessionRefs.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">还没有检测到关联会话。</div>
          ) : sessionRefs.map((ref) => (
            <div key={ref.sessionKey} className="rounded-[24px] border border-border/50 px-4 py-3.5 bg-background/75 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl border border-primary/15 bg-primary/5 flex items-center justify-center text-primary shadow-sm">
                      <Bot className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{ref.agentId}</div>
                      <div className="mt-1 inline-flex max-w-full rounded-full border border-border/50 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm break-all">{ref.sessionKey}</div>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full bg-background/80 shadow-sm">{getSourceLabel(ref.source)}</Badge>
              </div>
            </div>
          ))}
          {workerSessions.length > 0 && <div className="text-xs text-muted-foreground leading-relaxed">已捕获 {workerSessions.length} 个 worker / subagent 会话。后续主控回报会继续聚合进中间时间线。</div>}
        </div>
      </Card>
    </div>
  );
}
