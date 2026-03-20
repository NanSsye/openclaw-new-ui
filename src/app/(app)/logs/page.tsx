"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Terminal, Search, Trash2, Download, RefreshCw, 
  ArrowDownCircle, Database, Filter, ChevronDown, Clock,
  AlertCircle, ShieldAlert, Bug, Info, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

interface LogEntry {
  raw: string;
  time?: string | null;
  level?: LogLevel | null;
  subsystem?: string | null;
  message: string;
  meta?: unknown;
}

interface LogsTailResponse {
  lines?: string[];
  cursor?: number;
}

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

const LEVEL_COLORS: Record<string, string> = {
  trace: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
  debug: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  info: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  warn: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  error: "text-red-500 bg-red-500/10 border-red-500/20",
  fatal: "text-rose-600 bg-rose-600/20 border-rose-600/30 font-bold",
};

export default function LogsPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [filterText, setFilterText] = useState("");
  const [autoFollow, setAutoFollow] = useState(true);
  const [excludedLevels, setExcludedLevels] = useState<Set<LogLevel>>(new Set());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parseLogLine = (line: string): LogEntry => {
    if (!line.trim()) return { raw: line, message: line };
    try {
      const obj = JSON.parse(line);
      const meta = obj?._meta || {};
      const time = obj.time || meta.date || null;
      const level = (meta.logLevelName || meta.level || "info").toLowerCase() as LogLevel;
      
      const contextCandidate = obj["0"] || meta.name || null;
      let subsystem = null;
      try {
        if (contextCandidate && typeof contextCandidate === 'string' && contextCandidate.startsWith("{")) {
          const cObj = JSON.parse(contextCandidate);
          subsystem = cObj.subsystem || cObj.module || null;
        }
      } catch {
        // Ignore JSON parse errors for context
      }
      if (!subsystem && contextCandidate && contextCandidate.length < 100) subsystem = contextCandidate;

      let message = obj["1"] || obj.message || line;
      if (typeof message === 'object') message = JSON.stringify(message);

      return { raw: line, time, level, subsystem, message };
    } catch {
      // Fallback for non-JSON lines
      return { raw: line, message: line };
    }
  };

  const fetchLogs = async (isReset = false) => {
    if (!client || !connected) return;
    if (isReset) setLoading(true);
    try {
      const res: LogsTailResponse = await client.request("logs.tail", {
        cursor: isReset ? undefined : (cursor ?? undefined),
        limit: 1000,
        maxBytes: 1000000
      });
      
      const lines = Array.isArray(res.lines) ? res.lines : [];
      const newEntries = lines.map(parseLogLine);
      
      setEntries(prev => {
        const combined = isReset ? newEntries : [...prev, ...newEntries];
        return combined.slice(-2000);
      });
      
      if (typeof res.cursor === "number") setCursor(res.cursor);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      if (isReset) toast({ title: "加载日志失败", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [client, connected]);

  useEffect(() => {
    if (autoFollow) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => fetchLogs(false), 3000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoFollow, cursor]);

  useEffect(() => {
    if (autoFollow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoFollow]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.level && excludedLevels.has(e.level)) return false;
      if (!filterText) return true;
      const term = filterText.toLowerCase();
      return (
        e.message.toLowerCase().includes(term) ||
        (e.subsystem?.toLowerCase().includes(term)) ||
        e.raw.toLowerCase().includes(term)
      );
    });
  }, [entries, filterText, excludedLevels]);

  const toggleLevel = (level: LogLevel) => {
    const next = new Set(excludedLevels);
    if (next.has(level)) next.delete(level);
    else next.add(level);
    setExcludedLevels(next);
  };

  const handleExport = () => {
    const content = filteredEntries.map(e => e.raw).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openclaw-logs-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500 overflow-hidden">
      {/* Header */}
      <div className="px-3 md:px-6 py-2 md:py-3 border-b bg-background/50 backdrop-blur-xl shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">系统日志</h1>
          <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
            <Terminal className="size-3 text-emerald-500 shrink-0" />
            <span className="hidden sm:inline">实时监控系统运行日志与错误追踪</span>
            <span className="sm:hidden">实时日志追踪</span>
          </p>
        </div>
      </div>

      {/* Search & Controls Bar */}
      <div className="px-3 md:px-6 py-2 border-b bg-muted/30 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
        {/* Mobile Search */}
        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="搜索日志..."
            className="pl-8 h-8 text-xs rounded-lg border-border/50 bg-background/80"
          />
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="flex items-center gap-1.5 border-r pr-2 mr-1">
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap hidden sm:inline">自动追踪</span>
            <Switch
              checked={autoFollow}
              onCheckedChange={setAutoFollow}
              className="scale-75"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={loading} className="h-7 text-[10px] md:text-xs rounded-lg px-2">
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEntries([])} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-lg">
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Level Filter Bar */}
      <div className="px-3 md:px-6 py-1.5 border-b bg-muted/20 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap shrink-0 scrollbar-hide">
        {LEVELS.map(level => (
          <button
            key={level}
            onClick={() => toggleLevel(level)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all shrink-0",
              !excludedLevels.has(level)
                ? LEVEL_COLORS[level]
                : "bg-background/50 text-muted-foreground/30 border-transparent"
            )}
          >
            {level}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[9px] text-muted-foreground/60 font-mono shrink-0">
          <Activity className="size-2.5" />
          <span className="hidden sm:inline">{entries.length}/2000</span>
        </div>
      </div>

      {/* Main Log Terminal Container */}
      <div className="flex-1 px-2 md:px-4 py-2 overflow-hidden bg-[#0a0a0a]">
        <div
          ref={scrollRef}
          className="h-full rounded-xl border border-white/5 font-mono text-[10px] md:text-xs leading-relaxed selection:bg-emerald-500/30 overflow-y-auto"
        >
          <div className="p-3 md:p-4 space-y-0 min-h-full pb-16">
            {filteredEntries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-20 grayscale py-20">
                <Activity className="size-10 stroke-1" />
                <p className="text-xs">暂无匹配的系统日志</p>
              </div>
            ) : (
              filteredEntries.map((e, idx) => (
                <div key={idx} className="flex flex-col gap-0.5 group hover:bg-white/5 px-2 -mx-2 py-1 transition-colors border-l-2 border-transparent hover:border-emerald-500/50">
                  {/* Mobile: stacked layout, Desktop: inline */}
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-zinc-600 shrink-0 select-none text-[9px] md:text-[10px] hidden sm:block">
                      {e.time ? new Date(e.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "——"}
                    </span>

                    <span className={cn(
                      "shrink-0 px-1 rounded text-[8px] md:text-[9px] font-bold uppercase",
                      e.level ? LEVEL_COLORS[e.level].split(' ')[0] : "text-zinc-500"
                    )}>
                      {e.level || "info"}
                    </span>

                    {e.subsystem && (
                      <span className="shrink-0 text-emerald-500/60 text-[9px] hidden md:inline">
                        [{e.subsystem}]
                      </span>
                    )}

                    <span className={cn(
                      "flex-1 break-words whitespace-pre-wrap text-[10px] md:text-[11px]",
                      e.level === "error" || e.level === "fatal" ? "text-red-400" :
                      e.level === "warn" ? "text-amber-200" : "text-zinc-400"
                    )}>
                      {e.message.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')}
                    </span>
                  </div>
                  {/* Time on mobile */}
                  <div className="flex items-center gap-1 sm:hidden">
                    <span className="text-zinc-700 text-[8px]">{e.time ? new Date(e.time).toLocaleTimeString([], { hour12: false }) : ""}</span>
                  </div>
                </div>
              ))
            )}
            {autoFollow && (
              <div className="flex items-center gap-1.5 text-[9px] text-emerald-500/30 animate-pulse pt-2 border-t border-white/5">
                <div className="size-1 w-1.5 bg-emerald-500/30 rounded-full" />
                实时监听中
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Scroll Button */}
      {!autoFollow && (
        <button
          onClick={() => setAutoFollow(true)}
          className="fixed bottom-16 md:bottom-12 right-4 md:right-12 bg-emerald-600 text-white p-2.5 rounded-full shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all animate-bounce"
        >
          <ArrowDownCircle className="size-5" />
        </button>
      )}
    </div>
  );
}
