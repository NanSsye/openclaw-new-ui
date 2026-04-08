"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatToolDisplayName, formatToolDuration, formatToolOneLiner, normalizeToolPayload } from "@/lib/openclaw/tool-display";
import { AlertCircle, CheckCircle2, ChevronRight, Copy, Monitor, Wrench } from "lucide-react";

type Props = {
  name: string;
  status: "running" | "success" | "error";
  summary?: string;
  args?: unknown;
  detail?: unknown;
  durationMs?: number;
};

export function ToolCard({ name, status, summary, args, detail, durationMs }: Props) {
  const title = useMemo(() => formatToolDisplayName(name), [name]);
  const oneLiner = useMemo(() => {
    const normalizedSummary = typeof summary === "string" ? summary.trim() : "";
    return normalizedSummary || formatToolOneLiner(name, args);
  }, [summary, name, args]);
  const argsText = useMemo(() => normalizeToolPayload(args), [args]);
  const detailText = useMemo(() => normalizeToolPayload(detail), [detail]);
  const durationLabel = formatToolDuration(durationMs);
  const hasArgs = argsText.trim().length > 0 && argsText.trim() !== "{}";
  const hasDetail = detailText.trim().length > 0 && detailText.trim() !== "{}";
  const canOpen = hasArgs || hasDetail;
  const tone = {
    running: {
      icon: <Wrench className="size-3 text-orange-600" />,
      badge: "text-orange-600",
      dot: "bg-orange-500",
      card: "hover:border-orange-500/20",
      label: "运行中",
    },
    success: {
      icon: <CheckCircle2 className="size-3 text-emerald-600" />,
      badge: "text-emerald-600",
      dot: "bg-emerald-500",
      card: "hover:border-emerald-500/20",
      label: "完成",
    },
    error: {
      icon: <AlertCircle className="size-3 text-red-600" />,
      badge: "text-red-600",
      dot: "bg-red-500",
      card: "hover:border-red-500/20",
      label: "错误",
    },
  }[status];

  const body = (
    <div className={cn("my-1 rounded-[1.1rem] border border-border/30 bg-muted/5 shadow-sm transition-all", tone.card)}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="size-7 rounded-xl bg-background border border-border/35 flex items-center justify-center shrink-0">
          <Monitor className="size-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-[11px] uppercase tracking-tight truncate">{title}</span>
            {durationLabel ? <span className="text-[9px] font-mono text-muted-foreground/55 shrink-0">{durationLabel}</span> : null}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{oneLiner}</p>
        </div>
        <div className={cn("flex items-center gap-1.5 shrink-0", tone.badge)}>
          <span className={cn("size-1.5 rounded-full", tone.dot)} />
          <span className="hidden text-[9px] font-medium sm:inline">{tone.label}</span>
        </div>
      </div>
      {canOpen ? (
        <div className="flex items-center justify-between border-t border-border/20 px-3 py-1.5 text-[9px] text-muted-foreground/70">
          <span className="truncate">{hasDetail ? "查看输入和输出详情" : "查看输入详情"}</span>
          <ChevronRight className="size-3 shrink-0" />
        </div>
      ) : null}
    </div>
  );

  if (!canOpen) return body;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="block w-full text-left">{body}</button>
      </DialogTrigger>
      <DialogContent className="flex w-[min(96vw,56rem)] max-w-none flex-col rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-2xl bg-background border border-border/40 flex items-center justify-center shrink-0">
                <Monitor className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="pr-2 break-words">{title}</DialogTitle>
                <DialogDescription className="mt-1 line-clamp-2 break-all pr-2">{oneLiner}</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {durationLabel ? <span className="text-xs font-mono text-muted-foreground">{durationLabel}</span> : null}
              <div className={cn("flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2 py-1 text-[10px] font-medium", tone.badge)}>
                <span className="inline-flex">{tone.icon}</span>
                <span>{tone.label}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 max-h-[70vh] space-y-5 overflow-y-auto p-6">
          {hasArgs ? <ToolDetailSection title="Input" content={argsText} /> : null}
          {hasDetail ? <ToolDetailSection title="Output" content={detailText} /> : null}
          {!hasArgs && !hasDetail ? <p className="text-sm text-muted-foreground">No details available.</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolDetailSection({ title, content }: { title: string; content: string }) {
  return (
    <section className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-xl px-2 text-[10px]"
          onClick={() => navigator.clipboard.writeText(content).catch(() => {})}
        >
          <Copy className="size-3 mr-1" /> Copy
        </Button>
      </div>
      <pre className="max-h-[36vh] overflow-auto rounded-2xl border border-border/40 bg-muted/20 p-4 text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono text-foreground/85">
        {content}
      </pre>
    </section>
  );
}
