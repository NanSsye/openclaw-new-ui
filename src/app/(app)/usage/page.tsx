"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Coins,
  Database,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUsage } from "@/lib/openclaw/chat-types";

const formatNumber = (num: number) => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

const formatTokens = formatNumber;
const formatCost = (num: number) => `$${num.toFixed(4)}`;

type DailyUsage = {
  date: string;
  totalTokens?: number;
  totalCost?: number;
  input?: number;
  output?: number;
  cacheRead?: number;
};

type UsageSession = {
  key?: string;
  label?: string;
  sessionId?: string;
  model?: string;
  usage?: SessionUsage & { totalTokens?: number; totalCost?: number; cacheRead?: number };
};

type SessionsUsageResponse = {
  sessions?: UsageSession[];
  totals?: SessionUsage & { totalTokens?: number; totalCost?: number; cacheRead?: number };
};

type CostResponse = {
  daily?: DailyUsage[];
  totals?: SessionUsage & { totalTokens?: number; totalCost?: number; cacheRead?: number };
};

type TrendMode = "daily" | "sessions";

export default function UsagePage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<TrendMode>("daily");
  const [sessionsData, setSessionsData] = useState<SessionsUsageResponse | null>(null);
  const [costData, setCostData] = useState<CostResponse | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [days]);

  const fetchUsage = useCallback(async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const offsetMinutes = new Date().getTimezoneOffset();
      const sign = -offsetMinutes >= 0 ? "+" : "-";
      const absMinutes = Math.abs(offsetMinutes);
      const hours = Math.floor(absMinutes / 60);
      const mins = absMinutes % 60;
      const utcOffset = `UTC${sign}${hours}${mins === 0 ? "" : `:${String(mins).padStart(2, "0")}`}`;

      const reqArgs = {
        startDate,
        endDate,
        mode: "specific",
        utcOffset,
      };

      const [sessionsRes, costRes] = await Promise.all([
        client.request<SessionsUsageResponse>("sessions.usage", { ...reqArgs, limit: 100, includeContextWeight: true }).catch((err: unknown) => {
          if (err instanceof Error && String(err.message).includes("mode")) {
            return client.request<SessionsUsageResponse>("sessions.usage", { startDate, endDate, limit: 100 });
          }
          throw err;
        }),
        client.request<CostResponse>("usage.cost", reqArgs).catch((err: unknown) => {
          if (err instanceof Error && String(err.message).includes("mode")) {
            return client.request<CostResponse>("usage.cost", { startDate, endDate });
          }
          throw err;
        }),
      ]);

      setSessionsData(sessionsRes);
      setCostData(costRes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "拉取 usage.cost 或 sessions.usage 失败";
      toast({
        title: "获取使用情况失败",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [client, connected, endDate, startDate, toast]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const totals = useMemo(
    () => costData?.totals || sessionsData?.totals || { totalTokens: 0, totalCost: 0, input: 0, output: 0, cacheRead: 0 },
    [costData, sessionsData],
  );
  const daily = useMemo(() => costData?.daily || [], [costData]);
  const sessions = useMemo(() => sessionsData?.sessions || [], [sessionsData]);

  const filteredSessions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter((session) =>
      [session.label, session.sessionId, session.key, session.model]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join("\n")
        .toLowerCase()
        .includes(keyword),
    );
  }, [search, sessions]);

  const maxDailyTokens = Math.max(...daily.map((item) => item.totalTokens || 0), 100);
  const totalCost = totals.totalCost ?? 0;
  const totalTokens = totals.totalTokens ?? 0;
  const cacheRead = totals.cacheRead ?? 0;
  const cacheRate = totalTokens > 0 ? ((cacheRead / totalTokens) * 100).toFixed(1) : "0.0";
  const topSession = filteredSessions[0];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-muted/5 p-3 sm:p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4 pb-8 sm:space-y-6 sm:pb-12">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
              <Coins className="size-3.5" /> Usage Console
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">用量控制台</h1>
              <p className="text-sm text-muted-foreground">
                参考 clawket 的 Console 方式，把 token / cost / sessions 使用情况整理成可筛选、可切换的操作面板。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex w-full rounded-2xl border border-border/50 bg-background/80 p-1 shadow-sm sm:w-auto">
              {[7, 14, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(value)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                    days === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {value} 天
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={fetchUsage} disabled={loading} className="w-full rounded-2xl border-border/50 sm:w-auto">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              刷新
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Database}
            label="总 Token"
            value={formatNumber(totalTokens)}
            description={`输入 ${formatTokens(totals.input ?? 0)} · 输出 ${formatTokens(totals.output ?? 0)}`}
            tone="blue"
          />
          <MetricCard
            icon={Coins}
            label="总花费"
            value={formatCost(totalCost)}
            description="基于模型单价的估算结果"
            tone="emerald"
          />
          <MetricCard
            icon={Layers}
            label="缓存命中"
            value={formatNumber(cacheRead)}
            description={`${cacheRate}% 缓存命中率`}
            tone="amber"
          />
          <MetricCard
            icon={Activity}
            label="活跃会话"
            value={String(filteredSessions.length)}
            description={topSession?.label || topSession?.sessionId || topSession?.key || "暂无 Top Session"}
            tone="violet"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <Card className="border-border/50 bg-background/80 shadow-sm">
            <CardHeader className="border-b border-border/40">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{mode === "daily" ? "Daily Trend" : "Session Ranking"}</CardTitle>
                  <CardDescription>
                    {mode === "daily"
                      ? `查看 ${startDate} ~ ${endDate} 的每日 token / cost 趋势。`
                      : "切换到会话视图，快速观察最消耗资源的 session。"}
                  </CardDescription>
                </div>
                <Tabs value={mode} onValueChange={(value) => setMode(value as TrendMode)} className="w-full md:w-auto">
                  <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-border/50 bg-muted/20 p-1 md:w-auto md:justify-center">
                    <TabsTrigger value="daily" className="rounded-xl">走势</TabsTrigger>
                    <TabsTrigger value="sessions" className="rounded-xl">会话榜</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {mode === "daily" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoPill icon={TrendingUp} label="周期" value={`${startDate} ~ ${endDate}`} />
                    <InfoPill icon={Sparkles} label="日均消耗" value={formatNumber(Math.round(totalTokens / Math.max(days, 1)))} />
                  </div>
                  <div className="overflow-x-auto rounded-3xl border border-border/50 bg-muted/10 p-4">
                    <div className="flex min-h-[280px] min-w-[36rem] items-end gap-3">
                    {daily.length === 0 && !loading ? (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-border/50 text-sm text-muted-foreground">
                        当前周期暂无 usage.cost 数据
                      </div>
                    ) : (
                      daily.map((item) => {
                        const total = item.totalTokens || 0;
                        const input = item.input || 0;
                        const barHeight = Math.max((total / maxDailyTokens) * 100, 4);
                        const inputRatio = total > 0 ? (input / total) * 100 : 0;
                        return (
                          <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                            <div className="flex h-[220px] w-full items-end justify-center">
                              <div className="group relative flex h-full w-full max-w-[44px] items-end">
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-2 py-1 text-[10px] font-semibold text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                  {formatTokens(total)}
                                </div>
                                <div className="w-full rounded-t-xl bg-primary/20" style={{ height: `${barHeight}%` }}>
                                  <div className="w-full rounded-t-xl bg-primary/60" style={{ height: `${inputRatio}%` }} />
                                </div>
                              </div>
                            </div>
                            <div className="text-center text-[11px] font-mono text-muted-foreground">{item.date.slice(5)}</div>
                          </div>
                        );
                      })
                    )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="搜索 session key / 标签 / 模型"
                      className="pl-9"
                    />
                  </div>
                  <div className="space-y-3">
                    {filteredSessions.length === 0 && !loading ? (
                      <div className="rounded-2xl border-2 border-dashed border-border/50 px-4 py-14 text-center text-sm text-muted-foreground">
                        没有匹配到会话 usage 数据
                      </div>
                    ) : (
                      filteredSessions.slice(0, 12).map((session, index) => (
                        <div key={session.key || session.sessionId || index} className="rounded-3xl border border-border/50 bg-muted/10 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">#{index + 1}</Badge>
                                <p className="truncate font-semibold">{session.label || session.sessionId || session.key || "unknown"}</p>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant="secondary">{session.model || "Unknown Model"}</Badge>
                                <Badge variant="outline">Input {formatTokens(session.usage?.input || 0)}</Badge>
                                <Badge variant="outline">Output {formatTokens(session.usage?.output || 0)}</Badge>
                                <Badge variant="outline">Cache {formatTokens(session.usage?.cacheRead || 0)}</Badge>
                              </div>
                            </div>
                            <div className="shrink-0 text-left sm:text-right">
                              <p className="text-lg font-black text-primary">{formatTokens(session.usage?.totalTokens || 0)}</p>
                              <p className="text-xs text-muted-foreground">{formatCost(session.usage?.totalCost || 0)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/50 bg-background/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">周期摘要</CardTitle>
                <CardDescription>把成本、token 与 cache 命中聚合成更容易快速浏览的摘要。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SummaryRow label="时间范围" value={`${startDate} → ${endDate}`} />
                <SummaryRow label="总成本" value={formatCost(totalCost)} />
                <SummaryRow label="总 Token" value={formatTokens(totalTokens)} />
                <SummaryRow label="缓存命中" value={`${formatTokens(cacheRead)} / ${cacheRate}%`} />
                <SummaryRow label="活跃会话数" value={String(filteredSessions.length)} />
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-background/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Top Session</CardTitle>
                <CardDescription>快速看到当前周期里最“烧 token”的那个会话。</CardDescription>
              </CardHeader>
              <CardContent>
                {!topSession ? (
                  <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-4 py-12 text-center text-sm text-muted-foreground">
                    暂无会话 usage 数据
                  </div>
                ) : (
                  <div className="space-y-3 rounded-3xl border border-border/50 bg-muted/10 p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning"><Filter className="mr-1 size-3" /> Top</Badge>
                      <p className="truncate font-semibold">{topSession.label || topSession.sessionId || topSession.key}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{topSession.model || "Unknown Model"}</Badge>
                      <Badge variant="outline">Input {formatTokens(topSession.usage?.input || 0)}</Badge>
                      <Badge variant="outline">Output {formatTokens(topSession.usage?.output || 0)}</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniMetric label="Tokens" value={formatTokens(topSession.usage?.totalTokens || 0)} />
                      <MiniMetric label="Cost" value={formatCost(topSession.usage?.totalCost || 0)} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  description: string;
  tone: "blue" | "emerald" | "amber" | "violet";
}) {
  const toneClass = {
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  }[tone];

  return (
    <Card className="border-border/50 bg-background/80 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-black tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={cn("flex size-12 items-center justify-center rounded-2xl border", toneClass)}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoPill({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/10 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="break-words text-sm font-semibold">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
