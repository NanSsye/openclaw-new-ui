"use client";

import { AlertTriangle, Bot, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CollabWorkerState } from "@/lib/openclaw/collab-types";

function getStatusMeta(status: CollabWorkerState["status"]) {
  if (status === "reported") {
    return {
      label: "已回报",
      icon: <CheckCircle2 className="size-3.5" />,
      tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    };
  }
  if (status === "blocked") {
    return {
      label: "阻塞",
      icon: <AlertTriangle className="size-3.5" />,
      tone: "border-red-500/20 bg-red-500/10 text-red-600",
    };
  }
  if (status === "running") {
    return {
      label: "执行中",
      icon: <LoaderCircle className="size-3.5 animate-spin" />,
      tone: "border-blue-500/20 bg-blue-500/10 text-blue-600",
    };
  }
  if (status === "queued") {
    return {
      label: "已排队",
      icon: <Clock3 className="size-3.5" />,
      tone: "border-amber-500/20 bg-amber-500/10 text-amber-600",
    };
  }
  return {
    label: "待派发",
    icon: <Clock3 className="size-3.5" />,
    tone: "border-border/50 bg-background/80 text-muted-foreground",
  };
}

export function CollabActivityStrip({
  workers,
  selectedAgentId,
  onSelectAgent,
}: {
  workers: CollabWorkerState[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
}) {
  if (workers.length === 0) return null;

  return (
    <div className="rounded-[20px] sm:rounded-[22px] border border-border/50 bg-background/80 px-3 py-3 shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black tracking-tight">子 Agent 活动</p>
          <p className="text-xs text-muted-foreground mt-1">像参考项目一样，用更轻的横向活动条展示谁在忙什么。</p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => onSelectAgent("all")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-2 text-left transition-all",
            selectedAgentId === "all"
              ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
              : "border-border/50 bg-background/80 text-muted-foreground hover:bg-muted/10",
          )}
        >
          <div className="flex items-center gap-2">
            <Bot className="size-3.5" />
            <span className="text-xs font-semibold">全部</span>
          </div>
        </button>
        {workers.map((worker) => {
          const meta = getStatusMeta(worker.status);
          return (
            <button
              key={worker.agentId}
              type="button"
              onClick={() => onSelectAgent(worker.agentId)}
              className={cn(
                "shrink-0 rounded-[18px] border px-3 py-2 text-left transition-all min-w-[180px]",
                selectedAgentId === worker.agentId
                  ? "border-primary/30 bg-primary/10 shadow-sm"
                  : "border-border/50 bg-background/80 hover:bg-muted/10",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{worker.agentId}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", meta.tone)}>
                      {meta.icon}
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {worker.summary || (worker.sessionKey ? worker.sessionKey : "尚未建立子会话")}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
