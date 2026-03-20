"use client";
import { useEffect, useState } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Play, Clock, Settings, FileText, CheckCircle2, XCircle, AlertCircle, CalendarClock, Zap, Power, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

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

const formatSchedule = (schedule: any) => {
  if (!schedule) return "无规则";
  if (schedule.kind === "cron") return `Cron: ${schedule.expr}`;
  if (schedule.kind === "every") return `每 ${schedule.everyMs / 1000} 秒`;
  if (schedule.kind === "at") return `在 ${new Date(schedule.at).toLocaleString()}`;
  return "未知规则";
};

export default function TasksPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  const [runsLoading, setRunsLoading] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);

  const fetchData = async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const [statusRes, listRes] = await Promise.all([
        client.request("cron.status", {}),
        client.request("cron.list", { limit: 100, offset: 0 })
      ]);
      setStatus(statusRes);
      setJobs((listRes as any).jobs || []);
    } catch (err: any) {
      toast({ title: "加载 Cron 数据失败", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchRuns = async (jobId: string) => {
    if (!client || !connected) return;
    setRunsLoading(true);
    try {
      const runsRes = await client.request("cron.runs", { scope: "job", id: jobId, limit: 50 });
      setRuns((runsRes as any).runs || []);
    } catch (err: any) {
      toast({ title: "加载执行记录失败", description: err.message, variant: "destructive" });
    } finally {
      setRunsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [client, connected]);

  useEffect(() => {
    if (selectedJobId) {
      fetchRuns(selectedJobId);
    } else {
      setRuns([]);
    }
  }, [selectedJobId]);

  const toggleJob = async (job: any, enabled: boolean) => {
    if (!client) return;
    try {
      await client.request("cron.update", { id: job.id, patch: { enabled } });
      toast({ title: enabled ? "任务已启用" : "任务已禁用" });
      fetchData();
    } catch (err: any) {
      toast({ title: "切换状态失败", description: err.message, variant: "destructive" });
    }
  };

  const forceRunJob = async (job: any) => {
    if (!client) return;
    setRunningJobId(job.id);
    try {
      await client.request("cron.run", { id: job.id, mode: "force" });
      toast({ title: "调度成功", description: `已强制触发任务: ${job.name}` });
      if (selectedJobId === job.id) fetchRuns(job.id);
    } catch (err: any) {
      toast({ title: "手动执行失败", description: err.message, variant: "destructive" });
    } finally {
      setRunningJobId(null);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="p-3 md:p-6 shrink-0 border-b border-border/50 bg-background/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">定时任务</h1>
            <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
              <CalendarClock className="size-3 text-orange-500 shrink-0" />
              <span className="hidden sm:inline">管理自动化工作流</span>
              <span className="sm:hidden">管理工作流</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 text-xs md:text-sm h-8">
            <RefreshCw className={cn("size-3 md:size-4", loading && "animate-spin")} />
            刷新
          </Button>
        </div>

        {/* 统计卡片 - 移动端一行3个 */}
        <div className="max-w-7xl mx-auto mt-2 md:mt-4 grid grid-cols-3 gap-1.5 md:gap-3">
           <Card className="p-1.5 md:p-3 flex items-center gap-1.5 md:gap-2 bg-muted/20 border-border/50 rounded-lg md:rounded-xl">
             <div className="p-1 md:p-2 bg-primary/10 rounded-full text-primary shrink-0">
               <Power className="size-2.5 md:size-4" />
             </div>
             <div className="min-w-0 flex-1">
               <p className="text-[8px] md:text-[10px] font-medium text-muted-foreground truncate">全局</p>
               <p className="text-[10px] md:text-sm font-bold tracking-tight leading-tight">
                 {status?.enabled ? <span className="text-green-500">运行中</span> : <span className="text-red-500">停用</span>}
               </p>
             </div>
           </Card>

           <Card className="p-1.5 md:p-3 flex items-center gap-1.5 md:gap-2 bg-muted/20 border-border/50 rounded-lg md:rounded-xl">
             <div className="p-1 md:p-2 bg-blue-500/10 rounded-full text-blue-500 shrink-0">
               <Activity className="size-2.5 md:size-4" />
             </div>
             <div className="min-w-0 flex-1">
               <p className="text-[8px] md:text-[10px] font-medium text-muted-foreground truncate">任务</p>
               <p className="text-[10px] md:text-sm font-bold tracking-tight leading-tight">{status?.jobs ?? 0}</p>
             </div>
           </Card>

           <Card className="p-1.5 md:p-3 flex items-center gap-1.5 md:gap-2 bg-muted/20 border-border/50 rounded-lg md:rounded-xl">
             <div className="p-1 md:p-2 bg-orange-500/10 rounded-full text-orange-500 shrink-0">
               <Clock className="size-2.5 md:size-4" />
             </div>
             <div className="min-w-0 flex-1">
               <p className="text-[8px] md:text-[10px] font-medium text-muted-foreground truncate">下次</p>
               <p className="text-[9px] md:text-xs font-bold tracking-tight leading-tight truncate">
                 {status?.nextWakeAtMs ? formatRelativeTime(status.nextWakeAtMs) : "无"}
               </p>
             </div>
           </Card>
        </div>
      </div>

      {/* Main Workspace - Mobile: single pane with back navigation, Desktop: split pane */}
      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
        {/* Job List Pane */}
        <div className={cn(
          "flex flex-col overflow-hidden bg-background/30 border-border/50",
          selectedJobId && !window.matchMedia("(min-width: 1024px)").matches ? "hidden lg:flex lg:w-1/3" : "flex-1 lg:w-1/3",
          selectedJobId ? "hidden lg:flex" : "flex w-full"
        )}>
          <div className="w-full border-b border-border/50 p-2 md:p-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-wider">作业 ({jobs.length})</h2>
            </div>
            <Button variant="ghost" size="sm" className="h-6 md:h-7 text-[10px] md:text-xs text-primary hover:text-primary px-2">
               + 新建
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 md:p-2">
            <div className="flex flex-col gap-1 md:gap-1.5">
             {jobs.length === 0 && !loading && (
                <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg border-border/50">无工作流</div>
             )}
             {jobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={cn(
                    "p-2 md:p-2.5 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 flex flex-col gap-1",
                    selectedJobId === job.id ? "bg-muted/50 border-primary/50 shadow-sm" : "border-transparent bg-transparent"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                     <span className="font-semibold text-xs md:text-sm truncate flex-1 pr-2">{job.name}</span>
                     <Switch
                       checked={job.enabled}
                       onCheckedChange={(checked: boolean) => toggleJob(job, checked)}
                       onClick={(e: React.MouseEvent) => e.stopPropagation()}
                       className="data-[state=checked]:bg-green-500 scale-75 md:scale-90"
                     />
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-muted-foreground/60 truncate max-w-[160px] md:max-w-none">
                        <CalendarClock className="size-2 md:size-2.5 shrink-0" />
                        <span className="truncate">{formatSchedule(job.schedule)}</span>
                     </div>
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 md:h-6 md:w-6 hover:bg-primary/20 hover:text-primary rounded-full shrink-0"
                        onClick={(e) => { e.stopPropagation(); forceRunJob(job); }}
                        disabled={runningJobId === job.id}
                     >
                        <Zap className={cn("size-2.5", runningJobId === job.id && "animate-pulse")} />
                     </Button>
                  </div>
                </div>
             ))}
            </div>
          </div>
        </div>

        {/* Detail Pane - Mobile: slide over list, Desktop: side by side */}
        <div className={cn(
          "flex-1 overflow-y-auto bg-muted/10 custom-scrollbar",
          selectedJobId ? "flex" : "hidden lg:flex"
        )}>
          {!selectedJob ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 opacity-60">
               <CalendarClock className="size-12 md:size-16 stroke-1" />
               <p className="text-sm">选择作业查看详情</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-3 md:p-6 space-y-3 md:space-y-4">
               {/* Mobile back button */}
               <div className="flex items-center gap-2 lg:hidden">
                 <Button variant="ghost" size="icon" onClick={() => setSelectedJobId(null)} className="size-7 rounded-full">
                   <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                 </Button>
                 <h2 className="text-base font-bold truncate flex-1">{selectedJob.name}</h2>
               </div>

               {/* Desktop header */}
               <div className="hidden lg:block">
                 <h2 className="text-lg md:text-xl font-bold">{selectedJob.name}</h2>
                 <p className="text-muted-foreground text-xs md:text-sm mt-0.5">{selectedJob.description || "暂无描述"}</p>
               </div>

               <Tabs defaultValue="runs" className="w-full">
                  <TabsList className="bg-background border border-border/50 h-auto p-0.5 w-full justify-start gap-0.5 overflow-x-auto">
                    <TabsTrigger value="runs" className="data-[state=active]:bg-muted text-[10px] md:text-xs py-1.5 px-2.5 md:px-4 rounded-md whitespace-nowrap">
                       <Activity className="size-3 md:size-3.5 mr-1.5" />
                       执行记录
                    </TabsTrigger>
                    <TabsTrigger value="config" className="data-[state=active]:bg-muted text-[10px] md:text-xs py-1.5 px-2.5 md:px-4 rounded-md whitespace-nowrap">
                       <Settings className="size-3 md:size-3.5 mr-1.5" />
                       作业配置
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="runs" className="mt-2 md:mt-3 space-y-2 md:space-y-3">
                     {runsLoading ? (
                        <div className="p-6 text-center text-muted-foreground animate-pulse text-xs">加载中...</div>
                     ) : runs.length === 0 ? (
                        <div className="p-6 text-center border-2 border-dashed border-border/50 rounded-lg text-muted-foreground bg-background/50 text-xs">
                           暂无执行记录
                        </div>
                     ) : (
                        <div className="space-y-1.5 md:space-y-2">
                           {runs.map((run: any) => (
                              <Card key={run.id} className="p-2.5 md:p-3 border-l-4 rounded-r-lg bg-background/50 border-y-border/50 border-r-border/50" style={{ borderLeftColor: run.status === 'ok' ? '#10b981' : run.status === 'skipped' ? '#f59e0b' : '#ef4444' }}>
                                 <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                       {run.status === 'ok' ? <CheckCircle2 className="size-3 md:size-3.5 text-emerald-500 shrink-0" /> :
                                        run.status === 'skipped' ? <AlertCircle className="size-3 md:size-3.5 text-amber-500 shrink-0" /> :
                                        <XCircle className="size-3 md:size-3.5 text-red-500 shrink-0" />}
                                       <span className="font-semibold text-[11px] md:text-xs">
                                          {run.status === 'ok' ? '成功' : run.status === 'skipped' ? '跳过' : '失败'}
                                       </span>
                                       {run.mode === 'force' && <span className="text-[8px] bg-primary/20 text-primary px-1 py-0.5 rounded md:hidden">手动</span>}
                                       {run.mode === 'force' && <span className="text-[9px] hidden md:inline bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">手动触发</span>}
                                    </div>
                                    <span className="text-[8px] md:text-[10px] text-muted-foreground/60 font-mono shrink-0">{new Date(run.startedAt).toLocaleString()}</span>
                                 </div>
                                 {(run.error || run.message) && (
                                    <div className="mt-1.5 md:mt-2 p-1.5 md:p-2 bg-muted/50 rounded text-[9px] md:text-[10px] font-mono break-words opacity-80 leading-relaxed">
                                       {run.error || run.message}
                                    </div>
                                 )}
                              </Card>
                           ))}
                        </div>
                     )}
                  </TabsContent>

                  <TabsContent value="config" className="mt-2 md:mt-3">
                     <Card className="p-4 md:p-6 border-border/50 border-dashed bg-background/50 text-center text-muted-foreground min-h-[120px] md:min-h-[160px] flex flex-col items-center justify-center">
                        <Settings className="size-5 md:size-6 opacity-20 mb-2 md:mb-3" />
                        <p className="text-[10px] md:text-xs leading-relaxed">作业配置表单即将推出</p>
                     </Card>
                  </TabsContent>
                </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
