"use client";

import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

function formatContext(num: number): string {
  if (!num) return "0";
  if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(0) + "K";
  return num.toString();
}

export function ChatContextMonitor({
  mounted,
  portalId,
  totalTokens,
  contextLimit,
}: {
  mounted: boolean;
  portalId: string;
  totalTokens: number;
  contextLimit: number;
}) {
  const portalTarget = mounted ? document.getElementById(portalId) : null;
  if (!portalTarget) return null;

  const ratio = totalTokens / (contextLimit || 1);

  return createPortal(
    <div
      className="shrink-0 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-muted/50 border border-border/50 text-[9px] sm:text-[11px] font-medium tracking-widest text-muted-foreground/80 shadow-sm cursor-help hover:bg-muted/80 transition-all font-mono"
      title="当前上下文窗口状态"
    >
      <div
        className={cn(
          "size-1.5 sm:size-2 rounded-full shrink-0",
          ratio > 0.8 ? "bg-red-500" : ratio > 0.5 ? "bg-yellow-500" : "bg-emerald-500",
        )}
      />
      <span className="font-bold">{formatContext(totalTokens)}</span>
      <span className="opacity-30 text-[8px] sm:text-[10px]">/</span>
      <span className="opacity-50 font-bold">{formatContext(contextLimit)}</span>
    </div>,
    portalTarget,
  );
}
