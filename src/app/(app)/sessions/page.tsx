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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">会话管理</h1>
                <p className="text-muted-foreground">查看并管理网关跟踪的所有会话上下文。</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadSessions} disabled={loading} className="rounded-xl gap-2">
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                刷新列表
            </Button>
        </div>

        <div className="space-y-6">
          {Object.keys(grouped).length === 0 && !loading ? (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-3xl bg-background/50">
              <MessageSquare className="size-12 mb-4 opacity-10" />
              <p className="text-muted-foreground font-medium">当前没有公开会话</p>
            </div>
          ) : (
            Object.entries(grouped).map(([agentId, agentSessions]) => {
              const color = getAgentColor(agentId);
              return (
                <div key={agentId} className="space-y-3">
                  <div className="flex items-center gap-3 px-2">
                    <div className="size-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-black uppercase tracking-widest" style={{ color }}>{agentId}</span>
                    <div className="flex-1 h-px bg-border/30" />
                    <span className="text-xs text-muted-foreground">{agentSessions.length} 个会话</span>
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
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-all bg-background overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <div className="flex items-center p-4 md:p-6 gap-3 md:gap-6">
        <div className="size-10 md:size-12 rounded-2xl flex items-center justify-center shrink-0 border border-border/50" style={{ backgroundColor: `${color}10` }}>
            <Hash className="size-6" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 mb-1">
                <span className="font-bold text-base md:text-lg truncate">{data.label || data.key.split(":").pop()}</span>
                <div className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ backgroundColor: `${color}15`, color }}>
                    {data.scope || "global"}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-mono">
                    <Clock className="size-3" />
                    {(() => {
                      const ts = data.updatedAtMs || data.updatedAt || data.createdAt || data.timestamp || 0;
                      const d = new Date(ts);
                      return isNaN(d.getTime()) ? "未知" : d.toLocaleString("zh-CN", { hour12: false });
                    })()}
                </div>
                <div className="flex items-center gap-1.5 uppercase font-bold tracking-widest text-[9px]">
                    <Globe className="size-3" />
                    {data.thinkingLevel || "normal"}
                </div>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-xl">
                <ExternalLink className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5">
                <Trash2 className="size-4" />
            </Button>
        </div>
      </div>
    </Card>
  );
}
