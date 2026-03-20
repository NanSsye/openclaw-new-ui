"use client";

import { useEffect, useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/context/gateway-context";
import {
  MessageSquare, Clock, Globe, Hash,
  Trash2, ExternalLink, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

// Generate consistent color from agentId
const getAgentColor = (agentId: string) => {
  const hash = agentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
};

export default function SessionsPage() {
  const { connected, client } = useGateway();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    if (!connected || !client) return;
    setLoading(true);
    try {
      const res = await client.request("sessions.list", { limit: 100 });
      setSessions(res.sessions || []);
    } catch (e) {
      console.error("Failed to load sessions", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [connected, client]);

  // Group sessions by agent prefix
  const grouped = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    const agentPrefix = s.key?.startsWith("agent:") ? s.key.split(":")[1] : "main";
    if (!acc[agentPrefix]) acc[agentPrefix] = [];
    acc[agentPrefix].push(s);
    return acc;
  }, {});

  return (
    <main className="p-4 md:p-8 space-y-6 md:space-y-8 bg-muted/5">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">会话管理</h1>
                <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
                    <MessageSquare className="size-3 text-blue-500 shrink-0" />
                    <span className="hidden sm:inline">查看并管理网关跟踪的所有会话上下文</span>
                    <span className="sm:hidden">管理会话上下文</span>
                </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadSessions} disabled={loading} className="rounded-xl gap-1.5 text-xs md:text-sm h-8">
                <RefreshCw className={cn("size-3.5 md:size-4", loading && "animate-spin")} />
                <span className="hidden sm:inline">刷新列表</span>
                <span className="sm:hidden">刷新</span>
            </Button>
        </div>

        <div className="space-y-4 md:space-y-6">
          {Object.keys(grouped).length === 0 && !loading ? (
            <div className="h-48 md:h-64 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl md:rounded-3xl bg-background/50">
              <MessageSquare className="size-10 md:size-12 mb-3 md:mb-4 opacity-10" />
              <p className="text-muted-foreground font-medium text-sm md:text-base">当前没有公开会话</p>
            </div>
          ) : (
            Object.entries(grouped).map(([agentId, agentSessions]) => {
              const color = getAgentColor(agentId);
              return (
                <div key={agentId} className="space-y-2 md:space-y-3">
                  <div className="flex items-center gap-2 md:gap-3 px-1">
                    <div className="size-2.5 md:size-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs md:text-sm font-black uppercase tracking-widest" style={{ color }}>{agentId}</span>
                    <div className="flex-1 h-px bg-border/30" />
                    <span className="text-[10px] md:text-xs text-muted-foreground">{agentSessions.length} 个会话</span>
                  </div>
                  {agentSessions.map((s, i) => (
                    <SessionItem key={i} data={s} color={color} />
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

function SessionItem({ data, color }: { data: any; color: string }) {
  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-all bg-background overflow-hidden rounded-lg md:rounded-xl" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <div className="flex items-center p-2 md:p-4 gap-2 md:gap-4">
        <div className="size-8 md:size-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 border border-border/50" style={{ backgroundColor: `${color}10` }}>
            <Hash className="size-4 md:size-5" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2 mb-0.5">
                <span className="font-bold text-xs md:text-base truncate">{data.label || data.key.split(":").pop()}</span>
                <div className="px-1.5 py-0.5 rounded-full text-[7px] md:text-[10px] font-bold uppercase tracking-wider shrink-0 hidden sm:flex" style={{ backgroundColor: `${color}15`, color }}>
                    {data.scope || "global"}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] md:text-xs text-muted-foreground">
                <div className="flex items-center gap-1 font-mono">
                    <Clock className="size-2.5 md:size-3" />
                    {(() => {
                      const ts = data.updatedAtMs || data.updatedAt || data.createdAt || data.timestamp || 0;
                      const d = new Date(ts);
                      return isNaN(d.getTime()) ? "未知" : d.toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
                    })()}
                </div>
                <div className="flex items-center gap-1 uppercase font-bold tracking-widest text-[8px] md:text-[9px]">
                    <Globe className="size-2.5 md:size-3" />
                    {data.thinkingLevel || "normal"}
                </div>
            </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="size-7 md:size-8 rounded-lg md:rounded-xl">
                <ExternalLink className="size-3 md:size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 md:size-8 rounded-lg md:rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5">
                <Trash2 className="size-3 md:size-4" />
            </Button>
        </div>
      </div>
    </Card>
  );
}
