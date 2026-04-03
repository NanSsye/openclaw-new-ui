"use client";
import { useEffect, useState, useCallback } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Clock, Settings, CheckCircle2, XCircle, AlertCircle, CalendarClock, Zap, Power, Activity, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

const formatRelativeTime = (ms: number | null) => {
  if (!ms) return "未知";
  const diff = ms - Date.now();
  const absDiff = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

  if (absDiff < 60000) return rtf.format(Math.round(diff / 1000), "second");
  if (absDiff < 3600000) return rtf.format(Math.round(diff / 60000), "minute");
  if (absDiff < 86400000) return rtf.format(Math.round(diff / 3600000), "hour");
  return rtf.format(Math.round(diff / 86400000), "day");
};

const formatSchedule = (schedule?: Schedule) => {
  if (!schedule) return "无规则";
  if (schedule.kind === "cron") return `Cron: ${schedule.expr || ""}`;
  if (schedule.kind === "every") return `每 ${(schedule.everyMs ?? 0) / 1000} 秒`;
  if (schedule.kind === "at") return `在 ${new Date(schedule.at ?? 0).toLocaleString()}`;
  return "未知规则";
};

interface Schedule {
  kind?: "cron" | "every" | "at";
  expr?: string;
  everyMs?: number;
  at?: number;
}

interface CronStatus {
  enabled?: boolean;
  jobs?: number;
  nextWakeAtMs?: number;
}

interface Job {
  id: string;
  name: string;
  agentId?: string;
  description?: string;
  enabled?: boolean;
  schedule?: Schedule;
  createdAtMs?: number;
  updatedAtMs?: number;
  payload?: {
    kind?: string;
    message?: string;
    model?: string;
    thinking?: string;
  };
  state?: {
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastStatus?: string;
    lastDurationMs?: number;
    nextRunAtMs?: number;
  };
}

interface Run {
  ts: number;
  jobId: string;
  action?: string;
  status?: "ok" | "skipped" | "error";
  summary?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
  model?: string;
  provider?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  delivered?: boolean;
  deliveryStatus?: string;
  deliveryError?: string;
  error?: string;
  sessionId?: string;
  sessionKey?: string;
}

export default function TasksPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [runsLoading, setRunsLoading] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);

  const [editingJob, setEditingJob] = useState<{ name: string; description: string; enabled: boolean } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const fetchData = useCallback(async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const [statusRes, listRes] = await Promise.all([
        client.request("cron.status", {}),
        client.request("cron.list", { limit: 100, offset: 0 })
      ]);
      setStatus(statusRes);
      setJobs((listRes as { jobs?: Job[] }).jobs || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "加载 Cron 数据失败", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [client, connected, toast]);

  const fetchRuns = useCallback(async (jobId: string) => {
    if (!client || !connected) return;
    setRunsLoading(true);
    try {
      const runsRes = await client.request("cron.runs", { scope: "job", id: jobId, limit: 50 });
      setRuns((runsRes as { entries?: Run[] }).entries || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "加载执行记录失败", description: message, variant: "destructive" });
    } finally {
      setRunsLoading(false);
    }
  }, [client, connected, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedJobId) {
      fetchRuns(selectedJobId);
    } else {
      setRuns([]);
    }
  }, [selectedJobId, fetchRuns]);

  // Sync editingJob when selected job changes
  useEffect(() => {
    if (selectedJob) {
      setEditingJob({
        name: selectedJob.name || "",
        description: selectedJob.description || selectedJob.payload?.message || "",
        enabled: selectedJob.enabled ?? false
      });
    } else {
      setEditingJob(null);
    }
  }, [selectedJob]);

  const saveJobConfig = async () => {
    if (!client || !selectedJob || !editingJob) return;
    setSavingConfig(true);
    try {
      await client.request("cron.update", {
        id: selectedJob.id,
        patch: {
          name: editingJob.name,
          description: editingJob.description,
          enabled: editingJob.enabled
        }
      });
      toast({ title: "配置已保存" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "保存失败", description: message, variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleJob = async (job: Job, enabled: boolean) => {
    if (!client) return;
    try {
      await client.request("cron.update", { id: job.id, patch: { enabled } });
      toast({ title: enabled ? "任务已启用" : "任务已禁用" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "切换状态失败", description: message, variant: "destructive" });
    }
  };

  const forceRunJob = async (job: Job) => {
    if (!client) return;
    setRunningJobId(job.id);
    try {
      await client.request("cron.run", { id: job.id, mode: "force" });
      toast({ title: "调度成功", description: `已强制触发任务: ${job.name}` });
      if (selectedJobId === job.id) fetchRuns(job.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "手动执行失败", description: message, variant: "destructive" });
    } finally {
      setRunningJobId(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden animate-in fade-in duration-300">
      {/* Mobile Top Banner */}
      <div className="lg:hidden p-3 shrink-0 bg-background/80 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight">定时任务</h1>
            <p className="text-xs text-muted-foreground">管理自动化工作流</p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="size-8 rounded-full">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
        {/* Mobile Stats - Horizontal */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Card className="p-2 flex items-center gap-2 bg-muted/30 border-border/50 rounded-lg">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary shrink-0">
              <Power className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-medium text-muted-foreground truncate">全局</p>
              <p className="text-xs font-bold leading-tight">
                {status?.enabled ? <span className="text-green-500">运行</span> : <span className="text-red-500">停用</span>}
              </p>
            </div>
          </Card>
          <Card className="p-2 flex items-center gap-2 bg-muted/30 border-border/50 rounded-lg">
            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
              <Activity className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-medium text-muted-foreground truncate">作业</p>
              <p className="text-xs font-bold leading-tight">{status?.jobs ?? 0}</p>
            </div>
          </Card>
          <Card className="p-2 flex items-center gap-2 bg-muted/30 border-border/50 rounded-lg">
            <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-500 shrink-0">
              <Clock className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-medium text-muted-foreground truncate">下次</p>
              <p className="text-[10px] font-bold leading-tight truncate">
                {status?.nextWakeAtMs ? formatRelativeTime(status.nextWakeAtMs) : "无"}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* PC Top Banner */}
      <div className="hidden lg:block p-4 shrink-0 border-b border-border/50 bg-background/80">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">定时任务</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <CalendarClock className="size-4 text-orange-500" />
              <span>管理自动化工作流</span>
            </p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2 h-9">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            刷新
          </Button>
        </div>
        {/* PC Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4 max-w-2xl">
          <Card className="p-3 flex items-center gap-3 bg-muted/30 border-border/50 rounded-xl">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
              <Power className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">全局状态</p>
              <p className="text-base font-bold">
                {status?.enabled ? <span className="text-green-500">运行中</span> : <span className="text-red-500">停用</span>}
              </p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3 bg-muted/30 border-border/50 rounded-xl">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">作业数量</p>
              <p className="text-base font-bold">{status?.jobs ?? 0}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3 bg-muted/30 border-border/50 rounded-xl">
            <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500 shrink-0">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">下次执行</p>
              <p className="text-sm font-bold truncate">
                {status?.nextWakeAtMs ? formatRelativeTime(status.nextWakeAtMs) : "无"}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Mobile: Job List + Detail combined */}
      <div className="flex-1 lg:hidden min-h-0 flex flex-col overflow-hidden">
        {!selectedJobId ? (
          /* Mobile Job List */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between bg-muted/20 border-b border-border/50">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">作业 ({jobs.length})</h2>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary px-2">+ 新建</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <div className="flex flex-col gap-1.5">
                {jobs.length === 0 && !loading && (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl border-border/50">无工作流</div>
                )}
                {jobs.map(job => (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all cursor-pointer hover:bg-muted/50 flex flex-col gap-2",
                      selectedJobId === job.id ? "bg-muted/50 border-primary/50 shadow-sm" : "border-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate flex-1 pr-2">{job.name}</span>
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(checked) => toggleJob(job, checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-green-500 scale-90"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 truncate max-w-[160px]">
                        <CalendarClock className="size-3 shrink-0" />
                        <span className="truncate">{formatSchedule(job.schedule)}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-primary/20 rounded-full shrink-0"
                        onClick={(e) => { e.stopPropagation(); forceRunJob(job); }}
                        disabled={runningJobId === job.id}
                      >
                        <Zap className={cn("size-3", runningJobId === job.id && "animate-pulse")} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Mobile Detail */
          <div className="h-full flex flex-col overflow-hidden">
            {/* Back button + Header */}
            <div className="p-3 border-b border-border/50 bg-muted/10 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="icon" onClick={() => setSelectedJobId(null)} className="size-7 rounded-full shrink-0">
                  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </Button>
                <h2 className="text-sm font-bold truncate flex-1">{selectedJob?.name}</h2>
              </div>
              <p className="text-xs text-muted-foreground truncate">{selectedJob?.description || "暂无描述"}</p>
            </div>

            {/* Tabs */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <Tabs defaultValue="runs" className="flex-1 flex flex-col h-full">
                <TabsList className="w-full justify-start bg-muted/30 border-b rounded-none h-10 p-0 px-2 gap-1">
                  <TabsTrigger value="runs" className="data-[state=active]:bg-background text-xs py-2 px-3 rounded-lg">
                    <Activity className="size-3.5 mr-1.5" />
                    执行记录
                  </TabsTrigger>
                  <TabsTrigger value="config" className="data-[state=active]:bg-background text-xs py-2 px-3 rounded-lg">
                    <Settings className="size-3.5 mr-1.5" />
                    作业配置
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  <TabsContent value="runs" className="mt-0" asChild>
                    <div>
                      {runsLoading ? (
                        <div className="p-6 text-center text-muted-foreground animate-pulse text-xs">加载中...</div>
                      ) : runs.length === 0 ? (
                        <div className="p-6 text-center border-2 border-dashed border-border/50 rounded-xl text-muted-foreground text-xs">
                          暂无执行记录
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {runs.map((run: Run) => (
                            <Card key={run.ts} className="p-3 border-l-4 rounded-lg bg-background/80" style={{ borderLeftColor: run.status === 'ok' ? '#10b981' : run.status === 'skipped' ? '#f59e0b' : '#ef4444' }}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {run.status === 'ok' ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> :
                                   run.status === 'skipped' ? <AlertCircle className="size-4 text-amber-500 shrink-0" /> :
                                   <XCircle className="size-4 text-red-500 shrink-0" />}
                                  <span className="font-semibold text-sm">
                                    {run.status === 'ok' ? '成功' : run.status === 'skipped' ? '跳过' : '失败'}
                                  </span>
                                  {run.action === 'force' && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">手动</span>}
                                  {run.durationMs !== undefined && (
                                    <span className="text-xs text-muted-foreground/60">
                                      ({(run.durationMs / 1000).toFixed(2)}s)
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">{run.runAtMs ? new Date(run.runAtMs).toLocaleString() : "?"}</span>
                              </div>
                              {(run.error || run.summary) && (
                                <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono break-words">
                                  {run.error || run.summary}
                                </div>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="config" className="mt-0" asChild>
                    <div>
                      {editingJob && (
                        <Card className="p-4 border-border/50 bg-background/80">
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">作业名称</label>
                              <Input
                                value={editingJob.name}
                                onChange={(e) => setEditingJob({ ...editingJob, name: e.target.value })}
                                className="h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">作业描述</label>
                              <Input
                                value={editingJob.description}
                                onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })}
                                className="h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">调度规则</label>
                              <div className="p-2.5 bg-muted/30 rounded-lg border border-border/50 flex items-center gap-2">
                                <CalendarClock className="size-3.5 text-orange-500 shrink-0" />
                                <span className="text-xs font-mono truncate">
                                  {selectedJob?.schedule?.kind === "cron" && `Cron: ${selectedJob.schedule.expr}`}
                                  {selectedJob?.schedule?.kind === "every" && `每 ${((selectedJob.schedule.everyMs ?? 0) / 1000)} 秒`}
                                  {!selectedJob?.schedule && "无规则"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                              <div className="flex items-center gap-2">
                                <Zap className={cn("size-4", editingJob?.enabled ? "text-green-500" : "text-muted-foreground/30")} />
                                <span className="text-xs">{editingJob?.enabled ? "已启用" : "已停用"}</span>
                              </div>
                              <Switch
                                checked={editingJob?.enabled ?? false}
                                onCheckedChange={(checked) => editingJob && setEditingJob({ ...editingJob, enabled: checked })}
                                className="data-[state=checked]:bg-green-500"
                              />
                            </div>
                            <Button
                              onClick={saveJobConfig}
                              disabled={savingConfig || !editingJob.name.trim()}
                              className="w-full h-9 text-xs"
                            >
                              {savingConfig ? (
                                <><RefreshCw className="size-3 mr-1.5 animate-spin" />保存中...</>
                              ) : (
                                <><Save className="size-3 mr-1.5" />保存配置</>
                              )}
                            </Button>
                          </div>
                        </Card>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      {/* PC: Sidebar + Detail */}
      <div className="hidden lg:flex flex-row flex-1 min-h-0 overflow-hidden p-4 gap-4">
        {/* PC Job List */}
        <div className="w-72 xl:w-80 shrink-0 bg-background/80 border border-border/50 rounded-xl overflow-hidden flex flex-col">
          <div className="w-full border-b border-border/50 p-3 flex items-center justify-between bg-muted/20">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">作业 ({jobs.length})</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary px-2">+ 新建</Button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            <div className="flex flex-col gap-1.5">
              {jobs.length === 0 && !loading && (
                <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl border-border/50">无工作流</div>
              )}
              {jobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all cursor-pointer hover:bg-muted/50 flex flex-col gap-2",
                    selectedJobId === job.id ? "bg-muted/50 border-primary/50 shadow-sm" : "border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate flex-1 pr-2">{job.name}</span>
                    <Switch
                      checked={job.enabled}
                      onCheckedChange={(checked) => toggleJob(job, checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60 truncate max-w-[200px]">
                      <CalendarClock className="size-3.5 shrink-0" />
                      <span className="truncate">{formatSchedule(job.schedule)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-primary/20 rounded-full shrink-0"
                      onClick={(e) => { e.stopPropagation(); forceRunJob(job); }}
                      disabled={runningJobId === job.id}
                    >
                      <Zap className={cn("size-3.5", runningJobId === job.id && "animate-pulse")} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PC Detail */}
        <div className="flex-1 min-h-0 bg-background/50 border border-border/50 rounded-xl overflow-hidden flex flex-col">
          {!selectedJob ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 opacity-60">
              <CalendarClock className="size-16 stroke-1" />
              <p className="text-sm">选择作业查看详情</p>
            </div>
          ) : (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="p-4 border-b border-border/50 shrink-0 bg-muted/10">
                <h2 className="text-lg font-bold">{selectedJob.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedJob.description || "暂无描述"}</p>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <Tabs defaultValue="runs" className="flex-1 flex flex-col h-full">
                  <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-12 p-0 px-4 gap-1">
                    <TabsTrigger value="runs" className="data-[state=active]:bg-muted text-sm py-3 px-4 rounded-lg whitespace-nowrap">
                      <Activity className="size-4 mr-2" />
                      执行记录
                    </TabsTrigger>
                    <TabsTrigger value="config" className="data-[state=active]:bg-muted text-sm py-3 px-4 rounded-lg whitespace-nowrap">
                      <Settings className="size-4 mr-2" />
                      作业配置
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-y-auto p-4">
                    <TabsContent value="runs" className="mt-0 space-y-3" asChild>
                      <div>
                        {runsLoading ? (
                          <div className="p-8 text-center text-muted-foreground animate-pulse text-sm">加载中...</div>
                        ) : runs.length === 0 ? (
                          <div className="p-8 text-center border-2 border-dashed border-border/50 rounded-xl text-muted-foreground text-sm">
                            暂无执行记录
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {runs.map((run: Run) => (
                              <Card key={run.ts} className="p-4 border-l-4 rounded-xl bg-background/80" style={{ borderLeftColor: run.status === 'ok' ? '#10b981' : run.status === 'skipped' ? '#f59e0b' : '#ef4444' }}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {run.status === 'ok' ? <CheckCircle2 className="size-5 text-emerald-500 shrink-0" /> :
                                     run.status === 'skipped' ? <AlertCircle className="size-5 text-amber-500 shrink-0" /> :
                                     <XCircle className="size-5 text-red-500 shrink-0" />}
                                    <span className="font-semibold text-base">
                                      {run.status === 'ok' ? '成功' : run.status === 'skipped' ? '跳过' : '失败'}
                                    </span>
                                    {run.action === 'force' && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded ml-1">手动触发</span>}
                                    {run.durationMs !== undefined && (
                                      <span className="text-sm text-muted-foreground/60 ml-1">
                                        ({(run.durationMs / 1000).toFixed(2)}s)
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-sm text-muted-foreground/60 font-mono shrink-0">{run.runAtMs ? new Date(run.runAtMs).toLocaleString() : "?"}</span>
                                </div>
                                {(run.error || run.summary) && (
                                  <div className="mt-3 p-3 bg-muted/50 rounded-xl text-sm font-mono break-words leading-relaxed">
                                    {run.error || run.summary}
                                  </div>
                                )}
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="config" className="mt-0" asChild>
                      <div>
                        {editingJob && (
                          <Card className="p-5 border-border/50 bg-background/80">
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">作业名称</label>
                                <Input value={editingJob.name} onChange={(e) => setEditingJob({ ...editingJob, name: e.target.value })} className="h-10 text-sm" />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">作业描述</label>
                                <Input value={editingJob.description} onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })} className="h-10 text-sm" />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">调度规则</label>
                                <div className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center gap-2">
                                  <CalendarClock className="size-4 text-orange-500" />
                                  <span className="text-sm font-mono">
                                    {selectedJob?.schedule?.kind === "cron" && `Cron: ${selectedJob.schedule.expr}`}
                                    {selectedJob?.schedule?.kind === "every" && `每 ${((selectedJob.schedule.everyMs ?? 0) / 1000)} 秒`}
                                    {!selectedJob?.schedule && "无规则"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                                <div className="flex items-center gap-2">
                                  <Zap className={cn("size-5", editingJob?.enabled ? "text-green-500" : "text-muted-foreground/30")} />
                                  <span className="text-sm">{editingJob?.enabled ? "已启用" : "已停用"}</span>
                                </div>
                                <Switch
                                  checked={editingJob?.enabled ?? false}
                                  onCheckedChange={(checked) => editingJob && setEditingJob({ ...editingJob, enabled: checked })}
                                  className="data-[state=checked]:bg-green-500"
                                />
                              </div>
                              <Button onClick={saveJobConfig} disabled={savingConfig || !editingJob.name.trim()} className="w-full h-10 text-sm">
                                {savingConfig ? (<><RefreshCw className="size-4 mr-2 animate-spin" />保存中...</>) : (<><Save className="size-4 mr-2" />保存配置</>)}
                              </Button>
                            </div>
                          </Card>
                        )}
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
