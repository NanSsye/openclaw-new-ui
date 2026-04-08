"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Filter, GitBranch, ScrollText, UserCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageItem } from "@/components/chat/message-item";
import type { AgentItem } from "@/lib/openclaw/chat-types";
import type { CollabTimelineMessage } from "@/lib/openclaw/collab-types";

const SOURCE_LABELS: Record<CollabTimelineMessage["source"], string> = { root: "主控", worker: "Worker", subagent: "子会话", summary: "汇总", manual: "手动" };

export function CollabTimeline({ timeline, agents }: { timeline: CollabTimelineMessage[]; agents: AgentItem[]; }) {
  const [agentFilter, setAgentFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | CollabTimelineMessage["source"]>("all");
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const agentOptions = useMemo(() => {
    const seen = new Set<string>();
    return timeline
      .map((item) => item.agentId)
      .filter((agentId) => {
        if (!agentId || seen.has(agentId)) return false;
        seen.add(agentId);
        return true;
      });
  }, [timeline]);

  const filteredTimeline = useMemo(() => {
    return timeline.filter((item) => {
      if (agentFilter !== "all" && item.agentId !== agentFilter) return false;
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      return true;
    });
  }, [agentFilter, sourceFilter, timeline]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const timer = setTimeout(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
      setShowScrollBottomButton((prev) => (prev ? false : prev));
    }, 0);
    return () => clearTimeout(timer);
  }, [filteredTimeline.length, agentFilter, sourceFilter]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setShowScrollBottomButton((prev) => (prev ? false : prev));
  };

  return (
    <Card className="rounded-[24px] sm:rounded-[26px] overflow-hidden border-border/50 bg-background/85 backdrop-blur-xl shadow-sm min-h-[360px] md:min-h-[560px]">
      <div className="p-3 sm:p-4 border-b border-border/50 bg-gradient-to-r from-blue-500/5 to-background flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] sm:text-sm font-black tracking-tight">协作时间线</h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">聚合主控与 worker 的消息流。</p>
        </div>
        <Badge variant="outline" className="rounded-full bg-background/80 shadow-sm text-[10px] px-2 py-0.5">{filteredTimeline.length} / {timeline.length}</Badge>
      </div>

      <div className="px-3 pt-3 sm:px-4 sm:pt-4 md:px-5">
        <div className="rounded-[18px] sm:rounded-[22px] border border-border/50 bg-background/70 px-2.5 py-2 sm:px-3 sm:py-3 flex flex-col md:flex-row gap-2 sm:gap-3 md:items-center shadow-sm">
          <div className="hidden sm:inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground shrink-0">
            <Filter className="size-3.5" /> 过滤器
          </div>
          <div className="flex flex-1 gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 sm:h-9 justify-between rounded-full bg-background/80 backdrop-blur-sm border-border/50 text-[10px] sm:text-[11px] font-medium px-2.5 sm:px-3 hover:scale-[1.01] transition-all min-w-[132px] sm:min-w-[190px] shrink-0">
                  <span className="truncate">{agentFilter === "all" ? "全部 Agent" : agentFilter}</span>
                  <ChevronDown className="size-3 opacity-40 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-2xl border-border/50 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                <DropdownMenuItem onClick={() => setAgentFilter("all")} className="rounded-xl px-3 py-2 text-xs outline-none focus:bg-muted">
                  <span className="flex-1">全部 Agent</span>
                  {agentFilter === "all" && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
                {agentOptions.map((agentId) => (
                  <DropdownMenuItem key={agentId} onClick={() => setAgentFilter(agentId)} className="rounded-xl px-3 py-2 text-xs outline-none focus:bg-muted">
                    <span className="flex-1 truncate">{agentId}</span>
                    {agentFilter === agentId && <Check className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 sm:h-9 justify-between rounded-full bg-background/80 backdrop-blur-sm border-border/50 text-[10px] sm:text-[11px] font-medium px-2.5 sm:px-3 hover:scale-[1.01] transition-all min-w-[132px] sm:min-w-[190px] shrink-0">
                  <span className="truncate">{sourceFilter === "all" ? "全部来源" : sourceFilter === "root" ? "主控" : sourceFilter === "worker" ? "Worker" : sourceFilter === "subagent" ? "子会话" : "手动"}</span>
                  <ChevronDown className="size-3 opacity-40 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-2xl border-border/50 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                {[
                  ["all", "全部来源"],
                  ["root", "只看主控"],
                  ["worker", "只看 Worker"],
                  ["subagent", "只看子会话"],
                  ["manual", "只看手动"],
                ].map(([value, label]) => (
                  <DropdownMenuItem key={value} onClick={() => setSourceFilter(value as "all" | CollabTimelineMessage["source"])} className="rounded-xl px-3 py-2 text-xs outline-none focus:bg-muted">
                    <span className="flex-1">{label}</span>
                    {sourceFilter === value && <Check className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const target = event.currentTarget;
          const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
          const nextVisible = distanceToBottom > 160;
          setShowScrollBottomButton((prev) => (prev === nextVisible ? prev : nextVisible));
        }}
        className="relative p-3 sm:p-4 md:p-5 space-y-4 sm:space-y-5 max-h-[calc(100vh-13rem)] md:max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar"
      >
        {filteredTimeline.length === 0 ? (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed border-border/50 bg-muted/10 rounded-3xl">
            <ScrollText className="size-10 opacity-20 mb-4" />
            <p className="text-sm font-medium">{timeline.length === 0 ? "当前还没有聚合消息" : "当前过滤条件下没有消息"}</p>
            <p className="mt-2 text-xs max-w-md leading-relaxed">
              {timeline.length === 0
                ? "先向主控会话下发任务，或者尝试派发 worker。后续这个时间线会把多个 session 的消息合并显示。"
                : "你可以切换过滤器查看主控、Worker 或某个指定 Agent 的消息。"}
            </p>
          </div>
        ) : filteredTimeline.map((item) => (
          <div key={item.id} className="space-y-2.5 sm:space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-border/50 bg-background/90 px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-sm">
                {item.role === "user" ? <UserCircle2 className="size-3.5" /> : <Bot className="size-3.5" />}
                <span className="font-semibold">{item.agentId}</span>
              </div>
              <Badge variant="outline" className="rounded-full bg-background/90 shadow-sm text-[10px] px-2 py-0.5">{SOURCE_LABELS[item.source]}</Badge>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/50 bg-background/90 px-2 py-0.5 sm:px-2.5 sm:py-1 truncate shadow-sm text-[10px] sm:text-[11px]"><GitBranch className="size-3" /> {item.sessionKey}</span>
              <span className="ml-auto text-[10px] sm:text-[11px]">{new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="rounded-[22px] sm:rounded-[26px] border border-border/40 bg-background/75 px-3 sm:px-4 py-3 sm:py-4 shadow-sm">
              <MessageItem role={item.role} content={item.message.content} sender={item.message.sender} isStreaming={false} message={item.message} agents={agents} showDetails={true} />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
        {showScrollBottomButton && (
          <div className="sticky bottom-2 flex justify-end pr-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={scrollToBottom}
              className="size-7 rounded-full border-border/50 px-0 shadow-sm backdrop-blur-sm hover:scale-105 transition-all shrink-0 bg-background/80 text-muted-foreground"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function CollabTimelineControlled({
  timeline,
  agents,
  agentFilter,
  onAgentFilterChange,
}: {
  timeline: CollabTimelineMessage[];
  agents: AgentItem[];
  agentFilter: string;
  onAgentFilterChange: (value: string) => void;
}) {
  const [sourceFilter, setSourceFilter] = useState<"all" | CollabTimelineMessage["source"]>("all");
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const agentOptions = useMemo(() => {
    const seen = new Set<string>();
    return timeline
      .map((item) => item.agentId)
      .filter((id) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }, [timeline]);

  const filteredTimeline = useMemo(() => {
    return timeline.filter((item) => {
      if (agentFilter !== "all" && item.agentId !== agentFilter) return false;
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      return true;
    });
  }, [agentFilter, sourceFilter, timeline]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const timer = setTimeout(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
      setShowScrollBottomButton((prev) => (prev ? false : prev));
    }, 0);
    return () => clearTimeout(timer);
  }, [filteredTimeline.length, agentFilter, sourceFilter]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setShowScrollBottomButton((prev) => (prev ? false : prev));
  };

  return (
    <Card className="rounded-[24px] sm:rounded-[26px] overflow-hidden border-border/50 bg-background/85 backdrop-blur-xl shadow-sm min-h-[360px] md:min-h-[560px]">
      <div className="p-3 sm:p-4 border-b border-border/50 bg-gradient-to-r from-blue-500/5 to-background flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] sm:text-sm font-black tracking-tight">协作时间线</h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">聚合主控与 worker 的消息流。</p>
        </div>
        <Badge variant="outline" className="rounded-full bg-background/80 shadow-sm text-[10px] px-2 py-0.5">{filteredTimeline.length} / {timeline.length}</Badge>
      </div>

      <div className="px-3 pt-3 sm:px-4 sm:pt-4 md:px-5">
        <div className="rounded-[18px] sm:rounded-[22px] border border-border/50 bg-background/70 px-2.5 py-2 sm:px-3 sm:py-3 flex flex-col md:flex-row gap-2 sm:gap-3 md:items-center shadow-sm">
          <div className="hidden sm:inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground shrink-0">
            <Filter className="size-3.5" /> 过滤器
          </div>
          <div className="flex flex-1 gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 sm:h-9 justify-between rounded-full bg-background/80 backdrop-blur-sm border-border/50 text-[10px] sm:text-[11px] font-medium px-2.5 sm:px-3 hover:scale-[1.01] transition-all min-w-[132px] sm:min-w-[190px] shrink-0">
                  <span className="truncate">{agentFilter === "all" ? "全部 Agent" : agentFilter}</span>
                  <ChevronDown className="size-3 opacity-40 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-2xl border-border/50 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                <DropdownMenuItem onClick={() => onAgentFilterChange("all")} className="rounded-xl px-3 py-2 text-xs outline-none focus:bg-muted">
                  <span className="flex-1">全部 Agent</span>
                  {agentFilter === "all" && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
                {agentOptions.map((agentId) => (
                  <DropdownMenuItem key={agentId} onClick={() => onAgentFilterChange(agentId)} className="rounded-xl px-3 py-2 text-xs outline-none focus:bg-muted">
                    <span className="flex-1 truncate">{agentId}</span>
                    {agentFilter === agentId && <Check className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 sm:h-9 justify-between rounded-full bg-background/80 backdrop-blur-sm border-border/50 text-[10px] sm:text-[11px] font-medium px-2.5 sm:px-3 hover:scale-[1.01] transition-all min-w-[132px] sm:min-w-[190px] shrink-0">
                  <span className="truncate">{sourceFilter === "all" ? "全部来源" : sourceFilter === "root" ? "主控" : sourceFilter === "worker" ? "Worker" : sourceFilter === "subagent" ? "子会话" : "手动"}</span>
                  <ChevronDown className="size-3 opacity-40 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-2xl border-border/50 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                {[
                  ["all", "全部来源"],
                  ["root", "只看主控"],
                  ["worker", "只看 Worker"],
                  ["subagent", "只看子会话"],
                  ["manual", "只看手动"],
                ].map(([value, label]) => (
                  <DropdownMenuItem key={value} onClick={() => setSourceFilter(value as "all" | CollabTimelineMessage["source"])} className="rounded-xl px-3 py-2 text-xs outline-none focus:bg-muted">
                    <span className="flex-1">{label}</span>
                    {sourceFilter === value && <Check className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const target = event.currentTarget;
          const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
          const nextVisible = distanceToBottom > 160;
          setShowScrollBottomButton((prev) => (prev === nextVisible ? prev : nextVisible));
        }}
        className="relative p-3 sm:p-4 md:p-5 space-y-4 sm:space-y-5 max-h-[calc(100vh-13rem)] md:max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar"
      >
        {filteredTimeline.length === 0 ? (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed border-border/50 bg-muted/10 rounded-3xl">
            <ScrollText className="size-10 opacity-20 mb-4" />
            <p className="text-sm font-medium">{timeline.length === 0 ? "当前还没有聚合消息" : "当前过滤条件下没有消息"}</p>
            <p className="mt-2 text-xs max-w-md leading-relaxed">
              {timeline.length === 0
                ? "先向主控会话下发任务，或者尝试派发 worker。后续这个时间线会把多个 session 的消息合并显示。"
                : "你可以切换过滤器查看主控、Worker 或某个指定 Agent 的消息。"}
            </p>
          </div>
        ) : filteredTimeline.map((item) => (
          <div key={item.id} className="space-y-2.5 sm:space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-border/50 bg-background/90 px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-sm">
                {item.role === "user" ? <UserCircle2 className="size-3.5" /> : <Bot className="size-3.5" />}
                <span className="font-semibold">{item.agentId}</span>
              </div>
              <Badge variant="outline" className="rounded-full bg-background/90 shadow-sm text-[10px] px-2 py-0.5">{SOURCE_LABELS[item.source]}</Badge>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/50 bg-background/90 px-2 py-0.5 sm:px-2.5 sm:py-1 truncate shadow-sm text-[10px] sm:text-[11px]"><GitBranch className="size-3" /> {item.sessionKey}</span>
              <span className="ml-auto text-[10px] sm:text-[11px]">{new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="rounded-[22px] sm:rounded-[26px] border border-border/40 bg-background/75 px-3 sm:px-4 py-3 sm:py-4 shadow-sm">
              <MessageItem role={item.role} content={item.message.content} sender={item.message.sender} isStreaming={false} message={item.message} agents={agents} showDetails={true} />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
        {showScrollBottomButton && (
          <div className="sticky bottom-2 flex justify-end pr-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={scrollToBottom}
              className="size-7 rounded-full border-border/50 px-0 shadow-sm backdrop-blur-sm hover:scale-105 transition-all shrink-0 bg-background/80 text-muted-foreground"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
