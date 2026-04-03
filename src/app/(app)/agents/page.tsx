"use client";
import { useEffect, useState, useCallback } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, RefreshCw, Cpu, FileText, Wrench, Brain, Settings, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// 配置 API 返回的接口
interface ConfigResponse {
  path?: string;
  exists?: boolean;
  parsed?: {
    agents?: {
      defaults?: {
        model?: {
          primary?: string;
          fallbacks?: string[];
        };
      };
      list?: AgentConfig[];
    };
    models?: {
      providers?: Record<string, {
        models?: Array<{ id: string; name: string; cost?: { input?: number; output?: number } }>;
      }>;
    };
  };
}

interface AgentConfig {
  id: string;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: string;
  skills?: string[];
  tools?: {
    profile?: string;
    alsoAllow?: string[];
  };
}

// 工具目录 API 返回的接口
interface ToolsCatalogResponse {
  agentId?: string;
  profiles?: Array<{ id: string; label: string }>;
  groups?: Array<{
    id: string;
    label: string;
    source?: string;
    tools?: Array<{
      id: string;
      label: string;
      description?: string;
      source?: string;
    }>;
  }>;
}

export default function AgentsPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [configData, setConfigData] = useState<ConfigResponse | null>(null);
  const [toolsCatalog, setToolsCatalog] = useState<ToolsCatalogResponse | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const agents: AgentConfig[] = configData?.parsed?.agents?.list || [];
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const fetchData = useCallback(async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const [configRes, toolsRes] = await Promise.all([
        client.request("config.get"),
        client.request("tools.catalog")
      ]);
      setConfigData(configRes);
      setToolsCatalog(toolsRes);

      // 自动选择第一个代理
      if (!selectedAgentId && configRes?.parsed?.agents?.list?.length) {
        setSelectedAgentId(configRes.parsed.agents.list[0].id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "获取配置失败";
      toast({
        title: "加载代理数据失败",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [client, connected, selectedAgentId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 获取模型显示名称
  const getModelName = (modelId?: string) => {
    if (!modelId) return "未设置";
    // 从 providers 中查找
    const providers = configData?.parsed?.models?.providers || {};
    for (const provider of Object.values(providers)) {
      const model = provider.models?.find(m => `${Object.keys(providers).find(p => providers[p] === provider)}/${m.id}` === modelId || m.id === modelId);
      if (model) return model.name || modelId;
    }
    return modelId;
  };

  // 获取工具统计
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-300">
      {/* Page Header - Mobile Only */}
      <div className="lg:hidden p-3 shrink-0 bg-background/80 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">代理管理</h1>
            <p className="text-xs text-muted-foreground">共 {agents.length} 个代理</p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="size-8 rounded-full">
            <RefreshCw className={cn("size-4 text-muted-foreground", loading && "animate-spin")} />
          </Button>
        </div>
        {/* Mobile Agent Selector - Horizontal Pills */}
        <div className="flex gap-1.5 overflow-x-auto py-2 custom-scrollbar -mx-1 px-1">
          {agents.map((agent) => {
            const isSelected = selectedAgentId === agent.id;
            const title = agent.name || agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <Bot className="size-3" />
                <span className="max-w-[60px] truncate">{title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PC Layout: Sidebar + Content */}
      <div className="hidden lg:flex flex-row flex-1 min-h-0 p-4 gap-4">
        {/* Sidebar: Agents List - PC Only */}
        <Card className="w-72 xl:w-80 flex flex-col shrink-0 border-border/50 shadow-sm overflow-hidden bg-background/80 backdrop-blur-sm rounded-2xl">
          <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
            <div>
              <h2 className="text-sm font-bold tracking-tight">智能代理列表</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{agents.length} 个配置单元</p>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="size-8 rounded-full">
              <RefreshCw className={cn("size-4 text-muted-foreground", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {agents.length === 0 && !loading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无代理节点
              </div>
            ) : (
              agents.map((agent: AgentConfig) => {
                const isSelected = selectedAgentId === agent.id;
                const title = agent.name || agent.id;

                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left border-2",
                      isSelected
                        ? "bg-primary/10 border-primary/30 shadow-sm"
                        : "bg-transparent border-transparent hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "size-10 rounded-full flex items-center justify-center shrink-0 border-2",
                      isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border/50"
                    )}>
                      <Bot className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("font-semibold text-sm truncate", isSelected ? "text-primary" : "text-foreground")}>{title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate opacity-80 mt-0.5">
                        模型: {getModelName(agent.model)}
                      </p>
                      <p className="text-xs text-muted-foreground/50 font-mono mt-0.5">{agent.id.slice(0, 20)}...</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* PC Main Area */}
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden border border-border/50 bg-background/50">
          {!selectedAgent ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl m-4">
              <Bot className="size-16 mb-3 opacity-20" />
              <p className="text-sm">请选择一个智能代理查看详情</p>
            </div>
          ) : (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Agent Header Card */}
              <Card className="m-4 p-5 border-border/50 shadow-sm bg-gradient-to-br from-background to-muted/20 relative overflow-hidden rounded-2xl shrink-0">
                <div className="absolute right-0 top-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-8 -mt-16 pointer-events-none" />
                <div className="flex items-start gap-4 relative z-10">
                  <div className="size-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 shrink-0 border-2 border-primary/30">
                    <Bot className="size-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold tracking-tight truncate">{selectedAgent.name || selectedAgent.id}</h1>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      工作区: {selectedAgent.workspace || "未设置"}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-muted border border-border/50 text-foreground">
                        {selectedAgent.id.slice(0, 16)}...
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {selectedAgent.tools?.profile || "full"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Tabs */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-4">
                <Tabs defaultValue="overview" className="flex-1 flex flex-col h-full">
                  <TabsList className="w-full justify-start bg-transparent border-b border-border/50 rounded-none h-12 p-0 gap-1">
                    <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-4 font-medium text-sm shrink-0">
                      <FileText className="size-4 mr-2" />
                      概览
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-4 font-medium text-sm shrink-0">
                      <Wrench className="size-4 mr-2" />
                      工具
                    </TabsTrigger>
                    <TabsTrigger value="skills" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-4 font-medium text-sm shrink-0">
                      <Brain className="size-4 mr-2" />
                      技能
                    </TabsTrigger>
                    <TabsTrigger value="config" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-4 font-medium text-sm shrink-0">
                      <Settings className="size-4 mr-2" />
                      配置
                    </TabsTrigger>
                  </TabsList>

                  {/* PC Tab Contents */}
                  <TabsContent value="overview" className="flex-1 mt-4 space-y-4 focus-visible:outline-none overflow-y-auto">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="p-4 border-border/50 space-y-2 hover:border-primary/20 transition-colors bg-background/80 rounded-xl">
                        <div className="flex items-center gap-2 text-primary">
                          <Cpu className="size-4" />
                          <h3 className="font-semibold text-sm text-foreground">当前模型</h3>
                        </div>
                        <div className="text-sm truncate">{getModelName(selectedAgent.model)}</div>
                      </Card>
                      <Card className="p-4 border-border/50 space-y-2 hover:border-primary/20 transition-colors bg-background/80 rounded-xl">
                        <div className="flex items-center gap-2 text-blue-500">
                          <Wrench className="size-4" />
                          <h3 className="font-semibold text-sm text-foreground">工具配置</h3>
                        </div>
                        <div className="text-sm">
                          {selectedAgent.tools?.profile || "未设置"}
                          {(selectedAgent.tools?.alsoAllow?.length || 0) > 0 && (
                            <span className="text-muted-foreground ml-1">+{selectedAgent.tools?.alsoAllow?.length} 额外</span>
                          )}
                        </div>
                      </Card>
                      <Card className="p-4 border-border/50 space-y-2 hover:border-primary/20 transition-colors bg-background/80 rounded-xl">
                        <div className="flex items-center gap-2 text-green-500">
                          <Brain className="size-4" />
                          <h3 className="font-semibold text-sm text-foreground">技能数量</h3>
                        </div>
                        <div className="text-sm">{selectedAgent.skills?.length || 0} 个</div>
                      </Card>
                    </div>

                    {selectedAgent.skills && selectedAgent.skills.length > 0 && (
                      <Card className="p-4 border-border/50 bg-background/80 rounded-xl">
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                          <Brain className="size-4 text-purple-500" />
                          已启用技能
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedAgent.skills.map((skill, index) => (
                            <span key={index} className="px-3 py-1.5 rounded-lg text-xs bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </Card>
                    )}

                    {configData?.parsed?.agents?.defaults?.model?.fallbacks && (
                      <Card className="p-4 border-border/50 bg-background/80 rounded-xl">
                        <h3 className="font-semibold text-sm mb-3 text-muted-foreground">模型回退列表</h3>
                        <div className="space-y-2">
                          {configData.parsed.agents.defaults.model.fallbacks.map((model, index) => (
                            <div key={index} className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                              <span className="text-muted-foreground/50">{index + 1}.</span>
                              <span>{model}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="tools" className="flex-1 mt-4 focus-visible:outline-none overflow-y-auto">
                    <Card className="p-4 border-border/50 bg-background/80 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Wrench className="size-4 text-orange-500" />
                          工具配置
                        </h3>
                        <span className="text-sm text-muted-foreground">
                          当前配置: <span className="font-medium">{selectedAgent.tools?.profile || "未设置"}</span>
                        </span>
                      </div>

                      {selectedAgent.tools?.alsoAllow && selectedAgent.tools.alsoAllow.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-muted-foreground mb-2">额外启用的工具:</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedAgent.tools.alsoAllow.map((tool, index) => (
                              <span key={index} className="px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-600 border border-green-500/20">
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {toolsCatalog?.profiles && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-muted-foreground mb-2">可用工具配置:</h4>
                          <div className="flex flex-wrap gap-2">
                            {toolsCatalog.profiles.map((profile) => (
                              <span
                                key={profile.id}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs border",
                                  selectedAgent.tools?.profile === profile.id
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-muted/50 text-muted-foreground border-border/50"
                                )}
                              >
                                {profile.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>

                    {toolsCatalog?.groups && (
                      <div className="space-y-3 mt-3">
                        {toolsCatalog.groups.map((group) => (
                          <Card key={group.id} className="p-4 border-border/50 bg-background/80 rounded-xl">
                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                              <span className={cn(
                                "px-2 py-1 rounded-lg text-xs font-medium",
                                group.source === "core" ? "bg-blue-500/10 text-blue-600" :
                                group.source === "plugin" ? "bg-purple-500/10 text-purple-600" :
                                "bg-gray-500/10 text-gray-600"
                              )}>
                                {group.source || "unknown"}
                              </span>
                              {group.label}
                            </h3>
                            <div className="space-y-2">
                              {group.tools?.map((tool) => {
                                const isEnabled = !selectedAgent.tools?.alsoAllow ||
                                  selectedAgent.tools.alsoAllow.length === 0 ||
                                  selectedAgent.tools.alsoAllow.includes(tool.id);
                                return (
                                  <div key={tool.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium truncate">{tool.label || tool.id}</div>
                                      <div className="text-xs text-muted-foreground truncate">{tool.description}</div>
                                    </div>
                                    {isEnabled ? (
                                      <CheckCircle2 className="size-5 text-green-500 shrink-0" />
                                    ) : (
                                      <XCircle className="size-5 text-muted-foreground/30 shrink-0" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="skills" className="flex-1 mt-4 focus-visible:outline-none overflow-y-auto">
                    <Card className="p-4 border-border/50 bg-background/80 rounded-xl">
                      <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <Brain className="size-4 text-purple-500" />
                        已配置的技能 ({selectedAgent.skills?.length || 0})
                      </h3>

                      {selectedAgent.skills && selectedAgent.skills.length > 0 ? (
                        <div className="space-y-2">
                          {selectedAgent.skills.map((skill, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                              <Brain className="size-4 text-purple-500 shrink-0" />
                              <span className="text-sm font-medium">{skill}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          该代理未配置任何技能
                        </div>
                      )}
                    </Card>
                  </TabsContent>

                  <TabsContent value="config" className="flex-1 mt-4 focus-visible:outline-none overflow-y-auto">
                    <Card className="p-4 border-border/50 bg-background/80 rounded-xl">
                      <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <Settings className="size-4 text-gray-500" />
                        代理配置详情
                      </h3>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">代理ID</label>
                            <div className="text-xs font-mono p-3 bg-muted/30 rounded-lg break-all">{selectedAgent.id}</div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">代理名称</label>
                            <div className="text-xs p-3 bg-muted/30 rounded-lg">{selectedAgent.name || "未设置"}</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">工作区路径</label>
                          <div className="text-xs font-mono p-3 bg-muted/30 rounded-lg break-all">{selectedAgent.workspace || "未设置"}</div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">代理目录</label>
                          <div className="text-xs font-mono p-3 bg-muted/30 rounded-lg break-all">{selectedAgent.agentDir || "未设置"}</div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">工具配置</label>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <pre className="text-xs font-mono overflow-auto whitespace-pre-wrap">
                              {JSON.stringify(selectedAgent.tools, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout: Full width content */}
      <div className="flex-1 lg:hidden min-h-0 flex flex-col overflow-hidden">
        {!selectedAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-4">
            <Bot className="size-16 opacity-20" />
            <p className="text-sm">请选择一个智能代理</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Agent Header */}
            <Card className="m-2 p-3 border-border/50 shadow-sm bg-gradient-to-br from-background to-muted/20 relative overflow-hidden rounded-xl shrink-0">
              <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-4 -mt-8 pointer-events-none" />
              <div className="flex items-start gap-3 relative z-10">
                <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shrink-0 border border-primary/30">
                  <Bot className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-bold tracking-tight truncate">{selectedAgent.name || selectedAgent.id}</h1>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    工作区: {selectedAgent.workspace || "未设置"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-muted border border-border/50 text-foreground">
                      {selectedAgent.id.slice(0, 12)}...
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                      {selectedAgent.tools?.profile || "full"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Mobile Tabs */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <Tabs defaultValue="overview" className="flex-1 flex flex-col h-full">
                <TabsList className="w-full justify-start bg-muted/30 border-b border-border/50 rounded-none h-10 p-0 px-1 gap-0.5 overflow-x-auto">
                  <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 font-medium text-xs shrink-0">
                    <FileText className="size-3.5 mr-1.5" />
                    概览
                  </TabsTrigger>
                  <TabsTrigger value="tools" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 font-medium text-xs shrink-0">
                    <Wrench className="size-3.5 mr-1.5" />
                    工具
                  </TabsTrigger>
                  <TabsTrigger value="skills" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 font-medium text-xs shrink-0">
                    <Brain className="size-3.5 mr-1.5" />
                    技能
                  </TabsTrigger>
                  <TabsTrigger value="config" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 font-medium text-xs shrink-0">
                    <Settings className="size-3.5 mr-1.5" />
                    配置
                  </TabsTrigger>
                </TabsList>

                {/* Mobile Tab Contents */}
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  <TabsContent value="overview" className="mt-0 space-y-3">
                    <div className="grid grid-cols-1 gap-2">
                      <Card className="p-3 border-border/50 bg-background/80 rounded-lg">
                        <div className="flex items-center gap-2 text-primary">
                          <Cpu className="size-3.5" />
                          <h3 className="font-semibold text-xs text-foreground">当前模型</h3>
                        </div>
                        <div className="text-xs mt-1 truncate">{getModelName(selectedAgent.model)}</div>
                      </Card>
                      <Card className="p-3 border-border/50 bg-background/80 rounded-lg">
                        <div className="flex items-center gap-2 text-blue-500">
                          <Wrench className="size-3.5" />
                          <h3 className="font-semibold text-xs text-foreground">工具配置</h3>
                        </div>
                        <div className="text-xs mt-1">
                          {selectedAgent.tools?.profile || "未设置"}
                          {(selectedAgent.tools?.alsoAllow?.length || 0) > 0 && (
                            <span className="text-muted-foreground ml-1">+{selectedAgent.tools?.alsoAllow?.length}</span>
                          )}
                        </div>
                      </Card>
                      <Card className="p-3 border-border/50 bg-background/80 rounded-lg">
                        <div className="flex items-center gap-2 text-green-500">
                          <Brain className="size-3.5" />
                          <h3 className="font-semibold text-xs text-foreground">技能数量</h3>
                        </div>
                        <div className="text-xs mt-1">{selectedAgent.skills?.length || 0} 个</div>
                      </Card>
                    </div>

                    {selectedAgent.skills && selectedAgent.skills.length > 0 && (
                      <Card className="p-3 border-border/50 bg-background/80 rounded-lg">
                        <h3 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                          <Brain className="size-3.5 text-purple-500" />
                          已启用技能
                        </h3>
                        <div className="flex flex-wrap gap-1">
                          {selectedAgent.skills.map((skill, index) => (
                            <span key={index} className="px-2 py-1 rounded text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="tools" className="mt-0 space-y-3">
                    <Card className="p-3 border-border/50 bg-background/80 rounded-lg">
                      <h3 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                        <Wrench className="size-3.5 text-orange-500" />
                        工具配置
                      </h3>
                      <span className="text-xs text-muted-foreground">当前: <span className="font-medium">{selectedAgent.tools?.profile || "未设置"}</span></span>

                      {selectedAgent.tools?.alsoAllow && selectedAgent.tools.alsoAllow.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-[10px] font-medium text-muted-foreground mb-1">额外工具:</h4>
                          <div className="flex flex-wrap gap-1">
                            {selectedAgent.tools.alsoAllow.map((tool, index) => (
                              <span key={index} className="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-600 border border-green-500/20">
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>

                    {toolsCatalog?.groups && toolsCatalog.groups.map((group) => (
                      <Card key={group.id} className="p-3 border-border/50 bg-background/80 rounded-lg">
                        <h3 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-medium",
                            group.source === "core" ? "bg-blue-500/10 text-blue-600" :
                            group.source === "plugin" ? "bg-purple-500/10 text-purple-600" :
                            "bg-gray-500/10 text-gray-600"
                          )}>
                            {group.source || "unknown"}
                          </span>
                          {group.label}
                        </h3>
                        <div className="space-y-1">
                          {group.tools?.map((tool) => {
                            const isEnabled = !selectedAgent.tools?.alsoAllow ||
                              selectedAgent.tools.alsoAllow.length === 0 ||
                              selectedAgent.tools.alsoAllow.includes(tool.id);
                            return (
                              <div key={tool.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">{tool.label || tool.id}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">{tool.description}</div>
                                </div>
                                {isEnabled ? (
                                  <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                                ) : (
                                  <XCircle className="size-4 text-muted-foreground/30 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="skills" className="mt-0">
                    <Card className="p-3 border-border/50 bg-background/80 rounded-lg">
                      <h3 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                        <Brain className="size-3.5 text-purple-500" />
                        已配置技能 ({selectedAgent.skills?.length || 0})
                      </h3>
                      {selectedAgent.skills && selectedAgent.skills.length > 0 ? (
                        <div className="space-y-1.5">
                          {selectedAgent.skills.map((skill, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                              <Brain className="size-3.5 text-purple-500 shrink-0" />
                              <span className="text-xs font-medium">{skill}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-xs">
                          暂无技能
                        </div>
                      )}
                    </Card>
                  </TabsContent>

                  <TabsContent value="config" className="mt-0">
                    <Card className="p-3 border-border/50 bg-background/80 rounded-lg">
                      <h3 className="font-semibold text-xs mb-3 flex items-center gap-1.5">
                        <Settings className="size-3.5 text-gray-500" />
                        代理配置
                      </h3>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground">代理ID</label>
                          <div className="text-[10px] font-mono p-2 bg-muted/30 rounded break-all">{selectedAgent.id}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground">名称</label>
                          <div className="text-[10px] p-2 bg-muted/30 rounded">{selectedAgent.name || "未设置"}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground">工作区</label>
                          <div className="text-[10px] font-mono p-2 bg-muted/30 rounded break-all">{selectedAgent.workspace || "未设置"}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground">工具配置</label>
                          <div className="p-2 bg-muted/30 rounded">
                            <pre className="text-[9px] font-mono overflow-auto whitespace-pre-wrap">
                              {JSON.stringify(selectedAgent.tools, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
