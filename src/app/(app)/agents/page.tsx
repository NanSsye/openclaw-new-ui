"use client";
import { useEffect, useState } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bot, RefreshCw, Cpu, Box, Fingerprint, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [agentsList, setAgentsList] = useState<any>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const fetchAgents = async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const res = await client.request("agents.list");
      setAgentsList(res);
      if (!selectedAgentId && res?.agents?.length > 0) {
        setSelectedAgentId(res.defaultId || res.agents[0].id);
      }
    } catch (err: any) {
      toast({
        title: "无法获取代理列表",
        description: err.message || "请求 agents.list 失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [client, connected]);

  const agents = agentsList?.agents || [];
  const selectedAgent = agents.find((a: any) => a.id === selectedAgentId);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] p-2 lg:p-3 gap-2 lg:gap-3 max-w-7xl mx-auto animate-in fade-in duration-300 overflow-hidden">
      {/* Page Header - Mobile & Desktop */}
      <div className="shrink-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">代理管理</h1>
        <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
          <Bot className="size-3 text-purple-500 shrink-0" />
          <span className="hidden sm:inline">配置并管理智能代理的身份、权限与工具集</span>
          <span className="sm:hidden">管理智能代理</span>
        </p>
      </div>

      {/* Sidebar: Agents List - Hidden on mobile, shown on lg+ */}
      <Card className="hidden lg:flex w-72 xl:w-80 flex-col shrink-0 border-border/50 shadow-sm overflow-hidden bg-background/50 backdrop-blur-sm rounded-xl">
        <div className="p-3 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div>
            <h2 className="text-sm xl:text-base font-bold tracking-tight">智能代理列表</h2>
            <p className="text-[10px] xl:text-xs text-muted-foreground mt-0.5">{agents.length} 个配置单元</p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchAgents} disabled={loading} className="size-7 xl:size-8 rounded-full">
            <RefreshCw className={cn("size-3.5 xl:size-4 text-muted-foreground", loading && "animate-spin")} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 xl:p-3 space-y-1.5 xl:space-y-2 custom-scrollbar">
          {agents.length === 0 && !loading ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              暂无代理节点
            </div>
          ) : (
             agents.map((agent: any) => {
               const isSelected = selectedAgentId === agent.id;
               const isDefault = agentsList?.defaultId === agent.id;
               const title = agent.identity?.name || agent.name || agent.id;
               const subtitle = agent.identity?.theme || "Agent workspace";

               return (
                 <button
                   key={agent.id}
                   onClick={() => setSelectedAgentId(agent.id)}
                   className={cn(
                     "w-full flex items-start gap-2.5 xl:gap-3 p-2.5 xl:p-3 rounded-lg xl:rounded-xl transition-all text-left border border-transparent",
                     isSelected
                       ? "bg-primary/10 border-primary/20 shadow-sm"
                       : "hover:bg-muted/50"
                   )}
                 >
                   <div className={cn(
                     "size-8 xl:size-10 rounded-full flex items-center justify-center shrink-0 border",
                     isSelected ? "bg-primary text-primary-foreground border-primary/20" : "bg-muted border-border/50"
                   )}>
                     <Bot className="size-4 xl:size-5" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-1.5">
                       <span className={cn("font-semibold text-xs xl:text-sm truncate", isSelected ? "text-primary" : "text-foreground")}>{title}</span>
                       {isDefault && (
                         <span className="px-1 py-0.5 rounded text-[7px] xl:text-[9px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-600 border border-orange-500/20 shrink-0">默认</span>
                       )}
                     </div>
                     <p className="text-[10px] xl:text-xs text-muted-foreground truncate opacity-80 mt-0.5">{subtitle}</p>
                     <p className="text-[8px] xl:text-[10px] text-muted-foreground/60 font-mono mt-0.5">{agent.id.slice(0, 16)}</p>
                   </div>
                 </button>
               );
             })
          )}
        </div>
      </Card>

      {/* Main Area: Agent Details */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl">
        {/* Mobile Agent Selector - Horizontal Scrollable Chips */}
        <div className="lg:hidden -mx-2 px-2 border-b bg-muted/10 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto py-2 custom-scrollbar">
            {agents.length === 0 && !loading ? (
              <span className="text-xs text-muted-foreground">暂无代理节点</span>
            ) : (
              agents.map((agent: any) => {
                const isSelected = selectedAgentId === agent.id;
                const title = agent.identity?.name || agent.name || agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all shrink-0 border",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Bot className="size-3" />
                    <span className="max-w-[80px] truncate">{title}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {!selectedAgent ? (
           <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-b-xl bg-muted/10 m-1">
             <Bot className="size-12 mb-3 opacity-20" />
             <p className="text-xs">请选择一个智能代理查看详情</p>
           </div>
        ) : (
           <div className="h-full flex flex-col space-y-3 lg:space-y-4 animate-in slide-in-from-right-4 duration-300 p-2 lg:p-0">
             <Card className="p-3 lg:p-5 border-border/50 shadow-sm bg-gradient-to-br from-background to-muted/20 relative overflow-hidden rounded-lg lg:rounded-xl">
                <div className="absolute right-0 top-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-8 -mt-16 pointer-events-none" />

                <div className="flex items-start gap-2.5 lg:gap-4 relative z-10">
                  <div className="size-10 lg:size-14 rounded-xl lg:rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 shrink-0 border border-primary/50">
                    <Bot className="size-5 lg:size-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base lg:text-xl font-bold tracking-tight truncate">{selectedAgent.identity?.name || selectedAgent.name || selectedAgent.id}</h1>
                    <p className="text-[10px] lg:text-sm text-muted-foreground mt-0.5 truncate">{selectedAgent.identity?.theme || "Agent workspace"}</p>
                    <div className="flex items-center gap-1.5 lg:gap-2 mt-1.5 lg:mt-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 lg:px-2 lg:py-1 rounded text-[9px] lg:text-xs font-mono font-medium bg-muted border border-border/50 text-foreground truncate max-w-[100px] lg:max-w-none">
                        {selectedAgent.id.slice(0, 12)}...
                      </span>
                      {agentsList?.defaultId === selectedAgent.id && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[8px] lg:text-xs font-bold uppercase tracking-wider bg-orange-500/10 text-orange-600 border border-orange-500/20 shrink-0">
                          默认代理
                        </span>
                      )}
                    </div>
                  </div>
                </div>
             </Card>

             <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
               <Tabs defaultValue="overview" className="flex-1 flex flex-col h-full">
                 <TabsList className="w-full justify-start bg-transparent border-b border-border/50 rounded-none h-10 lg:h-12 p-0 px-1 overflow-x-auto flex-nowrap">
                   <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-2.5 lg:px-3 font-medium text-[11px] lg:text-sm shrink-0">概览</TabsTrigger>
                   <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-2.5 lg:px-3 font-medium text-[11px] lg:text-sm shrink-0">配置</TabsTrigger>
                   <TabsTrigger value="tools" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-2.5 lg:px-3 font-medium text-[11px] lg:text-sm shrink-0">工具</TabsTrigger>
                   <TabsTrigger value="skills" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-2.5 lg:px-3 font-medium text-[11px] lg:text-sm shrink-0">技能</TabsTrigger>
                 </TabsList>

                 <TabsContent value="overview" className="flex-1 mt-3 lg:mt-5 space-y-3 lg:space-y-5 focus-visible:outline-none overflow-y-auto">
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-4">
                     <Card className="p-3 lg:p-4 border-border/50 space-y-2 lg:space-y-3 hover:border-primary/20 transition-colors bg-background/50 rounded-lg lg:rounded-xl">
                        <div className="flex items-center gap-1.5 lg:gap-2 text-primary">
                          <Fingerprint className="size-3 lg:size-4" />
                          <h3 className="font-semibold text-[11px] lg:text-sm text-foreground">身份标识</h3>
                        </div>
                        <div className="text-[11px] lg:text-sm truncate">{selectedAgent.identity?.name || selectedAgent.name || selectedAgent.id}</div>
                     </Card>
                     <Card className="p-3 lg:p-4 border-border/50 space-y-2 lg:space-y-3 hover:border-primary/20 transition-colors bg-background/50 rounded-lg lg:rounded-xl">
                        <div className="flex items-center gap-1.5 lg:gap-2 text-blue-500">
                          <Cpu className="size-3 lg:size-4" />
                          <h3 className="font-semibold text-[11px] lg:text-sm text-foreground">工具权限</h3>
                        </div>
                        <div className="text-[11px] lg:text-sm capitalize">{selectedAgent.scope === "isolated" ? "独立隔离" : (selectedAgent.scope || "完全隔离")}</div>
                     </Card>
                     <Card className="p-3 lg:p-4 border-border/50 space-y-2 lg:space-y-3 hover:border-primary/20 transition-colors bg-background/50 rounded-lg lg:rounded-xl">
                        <div className="flex items-center gap-1.5 lg:gap-2 text-green-500">
                          <Box className="size-3 lg:size-4" />
                          <h3 className="font-semibold text-[11px] lg:text-sm text-foreground">网关核心</h3>
                        </div>
                        <div className="text-[11px] lg:text-sm font-mono text-muted-foreground truncate">{agentsList?.mainKey || "未分配"}</div>
                     </Card>
                   </div>
                   <Card className="p-4 lg:p-5 border-border/50 border-dashed bg-muted/10 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[100px] lg:min-h-[120px] rounded-lg lg:rounded-xl">
                     <p className="text-[11px] lg:text-sm">模型选择器 (Model Fallbacks) 面板正在组装</p>
                   </Card>
                 </TabsContent>

                 <TabsContent value="files" className="flex-1 mt-3 lg:mt-5 focus-visible:outline-none overflow-y-auto">
                   <Card className="p-4 lg:p-8 border-border/50 border-dashed bg-muted/10 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[150px] lg:min-h-[200px] rounded-lg lg:rounded-xl">
                     <Box className="size-6 lg:size-8 opacity-20 mb-2 lg:mb-3" />
                     <p className="text-[11px] lg:text-sm font-medium">配置与提示词修改模块开发中</p>
                     <p className="text-[9px] lg:text-xs mt-1 hidden sm:block">未来可在此直接热更 MEMORY.md 与工作流协议</p>
                   </Card>
                 </TabsContent>

                 <TabsContent value="tools" className="flex-1 mt-3 lg:mt-5 focus-visible:outline-none overflow-y-auto">
                   <Card className="p-4 lg:p-8 border-border/50 border-dashed bg-muted/10 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[150px] lg:min-h-[200px] rounded-lg lg:rounded-xl">
                     <Cpu className="size-6 lg:size-8 opacity-20 mb-2 lg:mb-3" />
                     <p className="text-[11px] lg:text-sm font-medium">专属工具挂载面板开发中</p>
                     <p className="text-[9px] lg:text-xs mt-1 hidden sm:block">控制此代理授权使用哪些底层核心工具箱</p>
                   </Card>
                 </TabsContent>

                 <TabsContent value="skills" className="flex-1 mt-3 lg:mt-5 focus-visible:outline-none overflow-y-auto">
                   <Card className="p-4 lg:p-8 border-border/50 border-dashed bg-muted/10 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[150px] lg:min-h-[200px] rounded-lg lg:rounded-xl">
                     <Fingerprint className="size-6 lg:size-8 opacity-20 mb-2 lg:mb-3" />
                     <p className="text-[11px] lg:text-sm font-medium">外挂专属技能库开发中</p>
                     <p className="text-[9px] lg:text-xs mt-1 hidden sm:block">将全局技能库中的特定技能桥接到此代理</p>
                   </Card>
                 </TabsContent>
               </Tabs>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
