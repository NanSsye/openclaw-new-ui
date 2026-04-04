"use client";

import { useMemo, useState } from "react";
import { Bot, Check, ChevronDown, PlusCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getAgentIdFromSessionKey, getSessionUpdatedAt } from "@/lib/openclaw/collab-normalizer";
import type { CreateCollabRoomInput, CollabAgentOption } from "@/lib/openclaw/collab-types";
import type { SessionItem } from "@/lib/openclaw/chat-types";
import { generateUUID } from "@/lib/openclaw/uuid";

const DEDICATED_SESSION_OPTION = "__dedicated_collab_session__";

function createDedicatedSessionKey(ownerAgentId: string) {
  const shortId = generateUUID().slice(0, 8);
  return ownerAgentId === "main"
    ? `collab:${shortId}`
    : `agent:${ownerAgentId}:collab:${shortId}`;
}

export function CollabTaskForm({ agents, sessions, onCreateRoom }: { agents: CollabAgentOption[]; sessions: SessionItem[]; onCreateRoom: (input: CreateCollabRoomInput) => void; }) {
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [ownerAgentId, setOwnerAgentId] = useState("main");
  const [rootSessionKey, setRootSessionKey] = useState(DEDICATED_SESSION_OPTION);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [autoIncludeWorkerSessions, setAutoIncludeWorkerSessions] = useState(false);

  const agentOptions = useMemo(() => {
    const base = [{ id: "main", name: "Main Agent" }, ...agents];
    const seen = new Set<string>();
    return base.filter((agent) => {
      if (!agent.id || seen.has(agent.id)) return false;
      seen.add(agent.id);
      return true;
    });
  }, [agents]);

  const ownerSessionOptions = useMemo(() => {
    const dedicated = { key: DEDICATED_SESSION_OPTION, label: "创建独立协作会话（推荐）" };
    const filtered = sessions.filter((session) => getAgentIdFromSessionKey(session.key) === ownerAgentId).sort((a, b) => getSessionUpdatedAt(b) - getSessionUpdatedAt(a));
    if (ownerAgentId === "main") {
      const hasMain = filtered.some((session) => session.key === "main");
      const base = hasMain ? filtered : [{ key: "main", label: "main", displayName: "main" }, ...filtered];
      return [dedicated, ...base];
    }
    if (filtered.length > 0) return [dedicated, ...filtered];
    return [dedicated, { key: `agent:${ownerAgentId}:main`, label: `${ownerAgentId} / main`, displayName: `${ownerAgentId} / main` }];
  }, [ownerAgentId, sessions]);

  const workerOptions = agentOptions.filter((agent) => agent.id !== ownerAgentId);

  const toggleWorker = (workerId: string) => {
    setSelectedWorkers((prev) => prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]);
  };

  const handleOwnerChange = (nextOwnerAgentId: string) => {
    setOwnerAgentId(nextOwnerAgentId);
    setRootSessionKey(DEDICATED_SESSION_OPTION);
    setSelectedWorkers((prev) => prev.filter((workerId) => workerId !== nextOwnerAgentId));
  };

  const handleCreate = () => {
    if (!task.trim()) return;
    const resolvedRootSessionKey = !rootSessionKey || rootSessionKey === DEDICATED_SESSION_OPTION
      ? createDedicatedSessionKey(ownerAgentId)
      : rootSessionKey;
    onCreateRoom({ title, task, notes, ownerAgentId, workerAgentIds: selectedWorkers, rootSessionKey: resolvedRootSessionKey, autoIncludeWorkerSessions });
    setTitle("");
    setTask("");
    setNotes("");
    setSelectedWorkers([]);
    setRootSessionKey(DEDICATED_SESSION_OPTION);
  };

  return (
    <Card className="rounded-[26px] overflow-hidden border-border/50 bg-background/85 backdrop-blur-xl shadow-sm">
      <div className="p-5 border-b border-border/50 bg-gradient-to-r from-primary/5 to-background">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-[18px] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight">新建协同任务</h2>
            <p className="text-xs text-muted-foreground mt-1">先选主控 Agent1，再把 worker 2/3/4 拉进来。</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">标题</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：插件市场巡检" className="rounded-[1.2rem] border-border/50 bg-background/80 shadow-sm backdrop-blur-sm" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">任务描述</Label>
          <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={5} placeholder="描述总任务。后续主控可以拆给多个 worker。" className="w-full rounded-[1.4rem] border border-border/50 bg-background/80 px-4 py-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm outline-none focus-visible:ring-0" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">主控 Agent</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 w-full justify-between rounded-full bg-background/80 backdrop-blur-sm border-border/50 px-4 text-sm font-medium shadow-sm hover:scale-[1.01] transition-all">
                  <span className="truncate">{agentOptions.find((agent) => agent.id === ownerAgentId)?.name || ownerAgentId}</span>
                  <ChevronDown className="size-3.5 opacity-40 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-2xl border-border/50 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                {agentOptions.map((agent) => (
                  <DropdownMenuItem key={agent.id} onClick={() => handleOwnerChange(agent.id)} className="rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-muted">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Bot className="size-4 text-primary/70" />
                      <span className="truncate">{agent.name || agent.id}</span>
                    </div>
                    {ownerAgentId === agent.id && <Check className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">主控会话</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 w-full justify-between rounded-full bg-background/80 backdrop-blur-sm border-border/50 px-4 text-sm font-medium shadow-sm hover:scale-[1.01] transition-all">
                  <span className="truncate">{rootSessionKey === DEDICATED_SESSION_OPTION ? "创建独立协作会话（推荐）" : (ownerSessionOptions.find((session) => session.key === rootSessionKey)?.label || rootSessionKey)}</span>
                  <ChevronDown className="size-3.5 opacity-40 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 rounded-2xl border-border/50 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                {ownerSessionOptions.map((session) => (
                  <DropdownMenuItem key={session.key} onClick={() => setRootSessionKey(session.key)} className="rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-muted">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{session.label || session.key}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{session.key}</div>
                    </div>
                    {rootSessionKey === session.key && <Check className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Worker 智能体</Label>
            <span className="text-[11px] text-muted-foreground">可多选，后续会尝试派发子会话</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {workerOptions.map((agent) => {
              const checked = selectedWorkers.includes(agent.id);
              return (
                <label key={agent.id} className={cn("flex items-center gap-3 rounded-2xl border px-3 py-3 cursor-pointer transition-all shadow-sm", checked ? "border-primary/40 bg-primary/5" : "border-border/50 bg-background/70 hover:bg-muted/30 hover:border-primary/20")}>
                  <Checkbox checked={checked} onCheckedChange={() => toggleWorker(agent.id)} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bot className="size-4 text-primary" />
                      <span className="text-sm font-medium truncate">{agent.name || agent.id}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{agent.id}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">备注 / 计划</Label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="可填写验收标准、汇报格式、协作规则。" className="w-full rounded-[1.4rem] border border-border/50 bg-background/80 px-4 py-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm outline-none focus-visible:ring-0" />
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/60 px-3 py-3 cursor-pointer hover:bg-muted/20 transition-colors shadow-sm">
          <Checkbox checked={autoIncludeWorkerSessions} onCheckedChange={(checked) => setAutoIncludeWorkerSessions(Boolean(checked))} />
          <div>
            <div className="text-sm font-medium">自动聚合 worker 的最新会话</div>
            <p className="text-xs text-muted-foreground mt-1">默认关闭，避免把同一 Agent 的旧会话和历史任务混进当前协作。</p>
          </div>
        </label>

        <Button onClick={handleCreate} disabled={!task.trim()} className="w-full rounded-full gap-2 font-bold shadow-sm bg-primary hover:scale-[1.01] transition-all">
          <PlusCircle className="size-4" /> 创建协作房间
        </Button>
      </div>
    </Card>
  );
}
