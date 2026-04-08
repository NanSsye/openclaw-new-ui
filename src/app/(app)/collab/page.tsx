"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, GitBranchPlus, Info, LayoutPanelTop, ListTodo, RefreshCw, Users } from "lucide-react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CollabTaskForm } from "@/components/collab/collab-task-form";
import { CollabRoomList } from "@/components/collab/collab-room-list";
import { CollabTimelineControlled } from "@/components/collab/collab-timeline";
import { CollabAgentPanel } from "@/components/collab/collab-agent-panel";
import { CollabActivityStrip } from "@/components/collab/collab-activity-strip";
import { useCollabRoom } from "@/hooks/use-collab-room";
import { useCollabSessions } from "@/hooks/use-collab-sessions";
import type { AgentItem } from "@/lib/openclaw/chat-types";
import type { CollabAgentOption, CollabConfigResponse } from "@/lib/openclaw/collab-types";

function getAgentsFromConfig(configRes: CollabConfigResponse) {
  return configRes.parsed?.agents?.list || configRes.config?.agents?.list || configRes.agents?.list || [];
}

export default function CollabPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  const [agents, setAgents] = useState<CollabAgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [mobileView, setMobileView] = useState<"timeline" | "tasks" | "control">("timeline");
  const [mobileIntroExpanded, setMobileIntroExpanded] = useState(false);
  const [timelineAgentFilter, setTimelineAgentFilter] = useState("all");
  const { rooms, activeRoomId, activeRoom, setActiveRoomId, createRoom, updateRoom, archiveRoom, restoreRoom, deleteRoom, setRoomHistoryCache } = useCollabRoom();

  const fetchAgents = useCallback(async () => {
    if (!client || !connected) return;
    setLoadingAgents(true);
    try {
      const res = await client.request<CollabConfigResponse>("config.get", {});
      setAgents(getAgentsFromConfig(res));
    } catch (error) {
      toast({ title: "加载 Agent 列表失败", description: error instanceof Error ? error.message : "无法读取配置中的 agents.list", variant: "destructive" });
    } finally {
      setLoadingAgents(false);
    }
  }, [client, connected, toast]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const collab = useCollabSessions({
    client,
    connected,
    room: activeRoom,
    onUpdateRoom: updateRoom,
    onPersistHistoryCache: setRoomHistoryCache,
    toast,
  });

  useEffect(() => {
    setTimelineAgentFilter("all");
  }, [activeRoomId]);

  const agentItems = useMemo<AgentItem[]>(() => [{ id: "main", name: "Main Agent" }, ...agents.map((agent) => ({ id: agent.id, name: agent.name }))], [agents]);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_28%),radial-gradient(circle_at_right,rgba(168,85,247,0.08),transparent_22%)] p-3 sm:p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto space-y-4 md:space-y-6">
        <div className="rounded-[20px] sm:rounded-[28px] border border-border/50 bg-background/80 backdrop-blur-xl shadow-sm px-3 py-2.5 sm:px-6 sm:py-6 space-y-2 sm:space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-3 min-w-0">
            <div className="inline-flex w-fit items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[8.5px] sm:px-3 sm:py-1.5 sm:text-[11px] font-black uppercase tracking-[0.1em] sm:tracking-[0.22em] text-primary shadow-sm"><GitBranchPlus className="size-2.5 sm:size-3.5" /> 协同模式</div>
            <div>
              <div className="flex items-center justify-between gap-3 sm:block">
                <h1 className="text-[22px] leading-none sm:text-3xl font-black tracking-tight">协同工作台</h1>
                <div className="flex sm:hidden items-center gap-1">
                  <Button variant="outline" size="icon" className="size-8 rounded-[14px] shadow-sm" onClick={fetchAgents} disabled={loadingAgents}><RefreshCw className={`size-3.5 ${loadingAgents ? "animate-spin" : ""}`} /></Button>
                  <Button variant="outline" size="icon" className="size-8 rounded-[14px] shadow-sm" onClick={collab.refreshRoom} disabled={!activeRoom || collab.loadingTimeline}><Users className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 rounded-[14px] text-muted-foreground" onClick={() => setMobileIntroExpanded((prev) => !prev)}><Info className="size-3.5" /></Button>
                </div>
              </div>
              <div className="mt-1.5 hidden sm:block">
                <p className="text-sm text-muted-foreground max-w-4xl leading-relaxed">聚合主控与 worker 会话，并保留执行痕迹。</p>
              </div>
              <div className="mt-2 hidden sm:flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">独立协作会话</span>
                <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">执行痕迹缓存</span>
                <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">移动端优先时间线</span>
              </div>
              <div className="mt-1.5 flex sm:hidden flex-wrap gap-1">
                <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[9px] text-muted-foreground">独立会话</span>
                <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[9px] text-muted-foreground">历史缓存</span>
              </div>
              {mobileIntroExpanded && (
                <div className="mt-2 sm:hidden rounded-[16px] border border-border/50 bg-background/70 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground shadow-sm">
                  聚合主控与 worker 会话，并保留执行痕迹。你可以先创建房间，再在时间线、房间、控制台之间切换查看协作过程。
                </div>
              )}
            </div>
          </div>
          <div className="hidden sm:grid grid-cols-2 gap-2 self-stretch xl:self-auto xl:flex xl:flex-wrap xl:items-center">
            <Button variant="outline" className="h-10 rounded-[18px] sm:rounded-2xl gap-2 shadow-sm text-[13px] sm:text-sm" onClick={fetchAgents} disabled={loadingAgents}><RefreshCw className={`size-4 ${loadingAgents ? "animate-spin" : ""}`} /> <span className="truncate">刷新 Agent</span></Button>
            <Button variant="outline" className="h-10 rounded-[18px] sm:rounded-2xl gap-2 shadow-sm text-[13px] sm:text-sm" onClick={collab.refreshRoom} disabled={!activeRoom || collab.loadingTimeline}><Users className="size-4" /> <span className="truncate">刷新房间</span></Button>
          </div>
        </div>

        <div className="xl:hidden sticky top-2 z-20 -mx-1">
          <div className="rounded-[18px] border border-border/50 bg-background/90 p-1 shadow-sm backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-1">
              <Button type="button" variant={mobileView === "timeline" ? "default" : "ghost"} onClick={() => setMobileView("timeline")} className="h-8 rounded-[14px] gap-1.5 px-2 text-[11px] font-semibold">
                <LayoutPanelTop className="size-3.5" /> 时间线
              </Button>
              <Button type="button" variant={mobileView === "tasks" ? "default" : "ghost"} onClick={() => setMobileView("tasks")} className="h-8 rounded-[14px] gap-1.5 px-2 text-[11px] font-semibold">
                <ListTodo className="size-3.5" /> 房间
              </Button>
              <Button type="button" variant={mobileView === "control" ? "default" : "ghost"} onClick={() => setMobileView("control")} className="h-8 rounded-[14px] gap-1.5 px-2 text-[11px] font-semibold">
                <Users className="size-3.5" /> 控制台
              </Button>
            </div>
          </div>
        </div>
        </div>

        {!connected && <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">当前尚未连接到网关，协同工作台只能显示本地房间草稿。请先完成登录或等待网关连通。</Card>}

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_360px] items-start">
          <div className={`order-2 xl:order-1 space-y-6 xl:sticky xl:top-6 ${mobileView === "tasks" ? "block" : "hidden xl:block"}`}>
            <CollabTaskForm agents={agents} sessions={collab.sessions} onCreateRoom={(input) => {
              const room = createRoom(input);
              toast({ title: "协作房间已创建", description: `主控 ${room.ownerAgentId} 已就位，可以开始下发任务。` });
              setMobileView("timeline");
            }} />
            <CollabRoomList rooms={rooms} activeRoomId={activeRoomId} onSelect={(roomId) => { setActiveRoomId(roomId); setMobileView("timeline"); }} onDelete={deleteRoom} onArchive={archiveRoom} onRestore={restoreRoom} />
          </div>

          <div className={`order-1 xl:order-2 space-y-6 min-w-0 ${mobileView === "timeline" ? "block" : "hidden xl:block"}`}>
            {activeRoom ? (
              <>
                <CollabActivityStrip
                  workers={collab.workerStates}
                  selectedAgentId={timelineAgentFilter}
                  onSelectAgent={setTimelineAgentFilter}
                />
                <CollabTimelineControlled
                  timeline={collab.timeline}
                  agents={agentItems}
                  agentFilter={timelineAgentFilter}
                  onAgentFilterChange={setTimelineAgentFilter}
                />
              </>
            ) : (
              <Card className="rounded-[22px] sm:rounded-3xl border-border/50 bg-background/80 backdrop-blur-sm min-h-[320px] sm:min-h-[560px] flex items-center justify-center p-5 sm:p-10 text-center">
                <div className="max-w-lg space-y-2.5 sm:space-y-4 text-muted-foreground">
                  <div className="mx-auto size-12 sm:size-16 rounded-[18px] sm:rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary"><Bot className="size-6 sm:size-8" /></div>
                  <h2 className="text-[18px] sm:text-xl font-black tracking-tight text-foreground leading-tight">先创建一个协作房间</h2>
                  <p className="text-[12px] sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-none">先选主控，再选 worker，系统会自动聚合协作时间线。</p>
                  <Button type="button" className="xl:hidden h-8 rounded-full px-4 text-[12px]" onClick={() => setMobileView("tasks")}>去创建任务</Button>
                </div>
              </Card>
            )}
          </div>

          <div className={`order-3 xl:order-3 ${mobileView === "control" ? "block" : "hidden xl:block"}`}>
            <CollabAgentPanel
              room={activeRoom}
              sessionRefs={collab.sessionRefs}
              workerStates={collab.workerStates}
              dispatchTemplates={collab.dispatchTemplates}
              loading={collab.loadingTimeline}
              dispatching={collab.dispatching}
              summarizing={collab.summarizing}
              onRefresh={collab.refreshRoom}
              onDispatch={collab.dispatchToWorkers}
              onDispatchTemplate={collab.dispatchTemplate}
              onRequestSummary={collab.requestSummary}
              onSendToOwner={collab.sendToOwner}
              onClearHistory={collab.clearHistoryCache}
              onArchiveRoom={() => activeRoom && archiveRoom(activeRoom.id)}
              onRestoreRoom={() => activeRoom && restoreRoom(activeRoom.id)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
