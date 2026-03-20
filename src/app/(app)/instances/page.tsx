"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGateway } from "@/context/gateway-context";
import { Cpu, Globe, Monitor, Shield, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InstancesPage() {
  const { presence } = useGateway();

  return (
    <main className="p-4 md:p-8 space-y-6 md:space-y-8 bg-muted/5">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">实例管理</h1>
          <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
            <Cpu className="size-3 text-primary shrink-0" />
            <span className="hidden sm:inline">监控当前连接到网关的所有活跃实例</span>
            <span className="sm:hidden">监控活跃实例</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
          {presence.length === 0 ? (
            <div className="col-span-full h-48 md:h-64 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl md:rounded-3xl bg-background/50">
              <Cpu className="size-10 md:size-12 mb-3 md:mb-4 opacity-10" />
              <p className="text-muted-foreground font-medium text-sm md:text-base">当前没有活跃实例</p>
            </div>
          ) : (
            presence.map((p, i) => (
              <InstanceCard key={i} data={p} />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function InstanceCard({ data }: { data: any }) {
  const isOnline = data.status === "online" || !data.status;

  return (
    <Card className="border-border/50 shadow-sm hover:border-primary/20 transition-all bg-background overflow-hidden flex flex-col rounded-xl md:rounded-2xl">
      <CardHeader className="p-2 md:p-4 pb-1 md:pb-3 bg-muted/5 border-b border-border/30">
        <div className="flex items-center justify-between gap-2">
            <div className={cn(
              "px-2 py-0.5 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-wider shrink-0",
              isOnline ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"
            )}>
              {isOnline ? "Online" : "Away"}
            </div>
            <span className="text-[8px] md:text-[10px] font-mono text-muted-foreground shrink-0">{data.id?.slice(0, 8) || "N/A"}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 md:mt-2">
            <Monitor className="size-4 md:size-5 text-primary shrink-0" />
            <CardTitle className="text-xs md:text-base font-bold truncate flex-1">
                {data.client?.name || "未知客户端"}
            </CardTitle>
        </div>
        <CardDescription className="truncate text-[9px] md:text-xs mt-0.5">
            {data.client?.version || "0.1.0"} • {data.client?.platform || "Web"}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-2 md:p-4 flex-1 space-y-2 md:space-y-3 hidden md:block">
        <div className="grid grid-cols-2 gap-2 md:gap-3">
            <InfoItem icon={<Globe className="size-3" />} label="区域" value={data.location || "Global"} />
            <InfoItem icon={<Shield className="size-3" />} label="角色" value={data.role || "Operator"} />
            <InfoItem icon={<Zap className="size-3" />} label="模式" value={data.client?.mode || "standard"} />
            <InfoItem icon={<Clock className="size-3" />} label="心跳" value="刚刚" />
        </div>

        {data.client?.userAgent && (
            <div className="pt-2 border-t border-border/50">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">User Agent</span>
                <p className="text-[9px] font-mono text-muted-foreground/80 line-clamp-2 leading-relaxed">
                    {data.client.userAgent}
                </p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoItem({ icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="space-y-0.5 md:space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
                {icon}
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-[10px] md:text-sm font-semibold truncate">{value}</p>
        </div>
    );
}
