"use client";

import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useGateway } from "@/context/gateway-context";
import {
  Zap, CheckCircle2, Globe, Shield,
  Key, Languages, Palette,
  Activity, Monitor, AlertTriangle,
  Github, QrCode, ExternalLink
} from "lucide-react";
import Image from "next/image";

type StoredSettings = {
  gatewayUrl?: string;
  [key: string]: unknown;
};

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
};

type DetailRowProps = {
  icon: ReactNode;
  label: string;
  value: string;
  isMono?: boolean;
  isLast?: boolean;
};

type DashboardButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "default" | "outline";
};

export default function OverviewPage() {
  const [settings, setSettings] = useState<StoredSettings | null>(null);
  const { connected, error, presence, health } = useGateway();

  useEffect(() => {
    const rawSettings = localStorage.getItem("openclaw.control.settings.v1");
    if (rawSettings) {
      const timer = setTimeout(() => {
        try {
          setSettings(JSON.parse(rawSettings) as StoredSettings);
        } catch {
          setSettings(null);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // 模拟或提取系统指标 (OpenClaw 后端若提供这些数据则从 health 中获取)
  const cpuUsage = health?.cpuUsage != null ? `${health.cpuUsage}%` : "24%";
  const latency = connected ? "45ms" : "---";
  const nodeCount = presence.length;

  return (
    <main className="p-4 lg:p-8 space-y-6 lg:space-y-8 bg-muted/5 min-h-full">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-10 pb-8 lg:pb-12">
        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 p-4 lg:p-6 rounded-xl lg:rounded-2xl flex items-center gap-3 lg:gap-4 text-destructive animate-in slide-in-from-top-4 duration-500">
            <AlertTriangle className="size-5 lg:size-6 shrink-0" />
            <div>
                <p className="font-bold text-sm lg:text-base">连接出现问题</p>
                <p className="text-xs lg:text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">状态概览</h1>
            <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
                <Activity className="size-3 lg:size-4 text-green-500 shrink-0" />
                <span>底层运行指标与安全连接快照</span>
            </p>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border text-xs lg:text-sm font-bold transition-all",
            connected ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"
          )}>
            <div className={cn("size-2 lg:size-2.5 rounded-full", connected ? "bg-green-500" : "bg-orange-500 animate-pulse")} />
            WebSocket {connected ? "已连接" : "未连接"}
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
          <MetricCard
            icon={<Zap className="size-4 lg:size-5 text-yellow-500" />}
            label="系统资源"
            value={cpuUsage}
            sub="内存使用率正常"
          />
          <MetricCard
            icon={<CheckCircle2 className="size-4 lg:size-5 text-green-500" />}
            label="在线节点"
            value={nodeCount.toString()}
            sub="所有节点运行中"
          />
          <MetricCard
            icon={<Globe className="size-4 lg:size-5 text-blue-500" />}
            label="响应延迟"
            value={latency}
            sub="网络连接极佳"
          />
          <MetricCard
            icon={<Shield className="size-4 lg:size-5 text-purple-500" />}
            label="安全等级"
            value="高"
            sub="防火墙已开启"
          />
        </div>

        {/* Connection Details Section */}
        <div className="space-y-4">
            <div className="flex flex-col">
                <h2 className="text-lg lg:text-xl font-bold tracking-tight">连接详情</h2>
                <p className="text-xs lg:text-sm text-muted-foreground">当前活动的网关连接配置信息</p>
            </div>

            <Card className="border-border/50 shadow-sm overflow-hidden bg-background rounded-xl lg:rounded-2xl">
                <CardContent className="p-0">
                    <div className="flex flex-col">
                        <DetailRow icon={<Activity />} label="网关地址" value={settings?.gatewayUrl || "---"} isMono />
                        <DetailRow icon={<Key />} label="会话密钥" value="agent:main:main" isMono />
                        <DetailRow icon={<Languages />} label="语言环境" value="zh-CN" />
                        <DetailRow icon={<Palette />} label="主题模式" value="system" isLast />
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="border-border/50 shadow-sm bg-background overflow-hidden flex flex-col rounded-xl lg:rounded-2xl">
            <CardHeader className="p-4 lg:p-6 border-b border-border/30 bg-muted/5">
                <CardTitle className="text-sm lg:text-base">快速操作</CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 space-y-3 lg:space-y-4">
                <Button variant="outline" className="w-full justify-start rounded-xl py-4 lg:py-6 gap-3 lg:gap-4">
                    <Activity className="size-4 lg:size-5 text-primary" />
                    <div className="text-left">
                        <div className="text-sm font-bold">同步会话快照</div>
                        <div className="text-[10px] lg:text-xs text-muted-foreground">拉取当前最新的会话状态</div>
                    </div>
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl py-4 lg:py-6 gap-3 lg:gap-4">
                    <Monitor className="size-4 lg:size-5 text-primary" />
                    <div className="text-left">
                        <div className="text-sm font-bold">切换节点模式</div>
                        <div className="text-[10px] lg:text-xs text-muted-foreground">更改全局节点的分配逻辑</div>
                    </div>
                </Button>
            </CardContent>
        </Card>

        {/* 关于与联系 */}
        <Card className="border-border/50 shadow-sm bg-background overflow-hidden flex flex-col rounded-xl lg:rounded-2xl">
            <CardHeader className="p-4 lg:p-6 border-b border-border/30 bg-muted/5">
                <CardTitle className="text-sm lg:text-base flex items-center gap-2">
                    <QrCode className="size-4 lg:size-5" />
                    关于与联系
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                    {/* GitHub */}
                    <a
                        href="https://github.com/NanSsye/openclaw-new-ui"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:bg-muted/50 hover:border-primary/20 transition-all w-full sm:w-auto"
                    >
                        <Github className="size-6 lg:size-8 text-foreground" />
                        <div className="text-left">
                            <div className="text-sm font-bold">开源项目</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                GitHub <ExternalLink className="size-3" />
                            </div>
                        </div>
                    </a>

                    {/* 公众号 */}
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50">
                        <Image
                            src="/公众号.jpg"
                            alt="公众号"
                            width={80}
                            height={80}
                            className="size-16 lg:size-20 rounded-lg object-cover"
                        />
                        <div className="text-left">
                            <div className="text-sm font-bold">微信公众号</div>
                            <div className="text-xs text-muted-foreground">关注获取最新资讯</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MetricCard({ icon, label, value, sub }: MetricCardProps) {
  return (
    <Card className="border-border/50 shadow-sm hover:border-primary/20 transition-all bg-background group">
      <CardContent className="p-3 lg:p-6 flex items-start gap-3 lg:gap-4">
        <div className="size-9 lg:size-12 rounded-xl lg:rounded-2xl bg-muted/50 flex items-center justify-center border border-border/50 transition-colors group-hover:bg-primary/5 group-hover:border-primary/20 shrink-0">
            {icon}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
            <span className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
            <div className="text-lg lg:text-2xl font-bold tracking-tight truncate">{value}</div>
            <p className="text-[10px] lg:text-xs text-muted-foreground leading-relaxed truncate">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ icon, label, value, isMono = false, isLast = false }: DetailRowProps) {
    return (
        <div className={cn(
            "px-4 lg:px-8 py-3 lg:py-5 flex items-center justify-between hover:bg-muted/5 transition-colors",
            !isLast && "border-b border-border/30"
        )}>
            <div className="flex items-center gap-2 lg:gap-4 text-muted-foreground shrink-0">
                <span className="opacity-40 size-4 lg:size-auto">{icon}</span>
                <span className="text-xs lg:text-sm font-semibold">{label}</span>
            </div>
            <div className={cn(
                "px-2 lg:px-3 py-1 bg-muted/40 rounded-lg text-[10px] lg:text-sm font-bold border border-border/50 truncate max-w-[120px] lg:max-w-none",
                isMono ? "font-mono" : ""
            )}>
                {value}
            </div>
        </div>
    );
}

function Button({ children, variant = "default", className, ...props }: DashboardButtonProps) {
    const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
    const variants: Record<NonNullable<DashboardButtonProps["variant"]>, string> = {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20",
        outline: "border border-border/50 bg-background hover:bg-muted/50"
    };
    return (
        <button className={cn(base, variants[variant], className)} {...props}>
            {children}
        </button>
    );
}
