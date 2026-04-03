"use client";
import { useEffect, useState, useCallback } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Server, Shield, Smartphone, RefreshCw, Activity, Globe, Trash2,
  ShieldAlert, Key, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Node {
  nodeId: string;
  displayName?: string;
  connected?: boolean;
  remoteIp?: string;
  version?: string;
  caps?: string[];
}

interface PairRequest {
  requestId: string;
  deviceId: string;
  displayName?: string;
  remoteIp?: string;
}

interface Token {
  role: string;
  revokedAtMs?: number;
}

interface Device {
  deviceId: string;
  displayName?: string;
  remoteIp?: string;
  roles?: string[];
  scopes?: string[];
  tokens?: Token[];
}

interface DevicesState {
  pending: PairRequest[];
  paired: Device[];
}

interface NodeListResponse {
  nodes?: Node[];
}

interface DevicePairListResponse {
  pending?: PairRequest[];
  paired?: Device[];
}

export default function NodesPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [devices, setDevices] = useState<DevicesState>({ pending: [], paired: [] });
  const [activeTab, setActiveTab] = useState("monitor");

  const fetchData = useCallback(async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const [nodesRes, devicesRes] = await Promise.all([
        client.request("node.list", {}),
        client.request("device.pair.list", {})
      ]);
      setNodes((nodesRes as NodeListResponse)?.nodes || []);
      setDevices({
        pending: Array.isArray((devicesRes as DevicePairListResponse)?.pending) ? (devicesRes as DevicePairListResponse).pending! : [],
        paired: Array.isArray((devicesRes as DevicePairListResponse)?.paired) ? (devicesRes as DevicePairListResponse).paired! : []
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "加载数据失败", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [client, connected, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (requestId: string) => {
    if (!client) return;
    try {
      await client.request("device.pair.approve", { requestId });
      toast({ title: "配对成功", description: "该设备已成功接入。 " });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "审批失败", description: message, variant: "destructive" });
    }
  };

  const handleReject = async (requestId: string) => {
    if (!client) return;
    if (!window.confirm("确定拒绝并删除此配对请求吗？")) return;
    try {
      await client.request("device.pair.reject", { requestId });
      toast({ title: "已拒绝请求" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "操作失败", description: message, variant: "destructive" });
    }
  };

  const handleRevoke = async (deviceId: string, role: string) => {
    if (!client) return;
    if (!window.confirm(`确定要撤销设备 ${deviceId} 的 ${role} 权限吗？`)) return;
    try {
      await client.request("device.token.revoke", { deviceId, role });
      toast({ title: "权限已撤销" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "撤销失败", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="p-3 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">集群节点</h1>
          <p className="text-muted-foreground text-[10px] sm:text-xs md:text-sm flex items-center gap-2 mt-0.5">
            <Server className="size-3 md:size-4 text-cyan-500 shrink-0" />
            <span className="hidden md:inline">实时监控目前连接到主控制网关的所有代理工作节点及受控设备</span>
            <span className="md:hidden">监控工作节点</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 rounded-lg text-xs sm:text-sm self-start sm:self-auto">
          <RefreshCw className={cn("size-3.5 sm:size-4", loading && "animate-spin")} />
          <span className="hidden sm:inline">刷新状态</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/30 p-1 border border-border/50 rounded-xl lg:rounded-2xl h-auto">
          <TabsTrigger value="monitor" className="rounded-lg lg:rounded-xl px-3 lg:px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs lg:text-sm">
            <Activity className="size-3.5 lg:size-4 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">监控面板</span>
            <span className="sm:hidden">监控</span>
          </TabsTrigger>
          <TabsTrigger value="pairing" className="rounded-lg lg:rounded-xl px-3 lg:px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs lg:text-sm">
            <Shield className="size-3.5 lg:size-4 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">设备配对</span>
            <span className="sm:hidden">配对</span>
            {devices.pending.length > 0 && <Badge variant="destructive" className="ml-1.5 px-1.5 h-4 min-w-4 flex items-center justify-center text-[10px]">{devices.pending.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="mt-4 md:mt-6 lg:mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
            {nodes.length === 0 && !loading && (
              <Card className="col-span-full p-8 md:p-12 text-center border-dashed bg-muted/20 opacity-60">
                <Server className="size-10 md:size-12 mx-auto mb-3 md:mb-4 stroke-1" />
                <p className="text-sm">暂无在线节点</p>
              </Card>
            )}
            {nodes.map(node => (
              <Card key={node.nodeId} className="group relative overflow-hidden bg-background/50 border-border/50 hover:border-primary/30 transition-all duration-300">
                <div className="p-3 md:p-4 lg:p-6 space-y-2 md:space-y-3 lg:space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm md:text-base lg:text-lg truncate mb-0.5 md:mb-1">
                        {node.displayName || node.nodeId}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-mono text-muted-foreground opacity-60">
                        <Globe className="size-2.5 md:size-3 shrink-0" />
                        <span className="truncate">{node.nodeId}</span>
                      </div>
                    </div>
                    <Badge variant={node.connected ? "success" : "destructive"} className="text-[9px] md:text-[10px] shrink-0">
                      {node.connected ? "在线" : "离线"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 md:gap-2 text-[10px] md:text-xs">
                    <div className="p-1.5 md:p-2 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase mb-0.5">内网地址</p>
                      <p className="font-mono font-medium truncate">{node.remoteIp || "未知"}</p>
                    </div>
                    <div className="p-1.5 md:p-2 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase mb-0.5">版本</p>
                      <p className="font-mono font-medium truncate">{node.version || "n/a"}</p>
                    </div>
                  </div>

                  <div className="space-y-1 md:space-y-2">
                    <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">支持能力</p>
                    <div className="flex flex-wrap gap-1">
                      {node.caps?.map((cap: string) => (
                        <Badge key={cap} variant="secondary" className="text-[8px] md:text-[9px] py-0 px-1 md:py-0 md:px-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pairing" className="mt-4 md:mt-6 lg:mt-8 space-y-4 md:space-y-6">
          {/* Pending Requests */}
          {devices.pending.length > 0 && (
            <div className="space-y-3 md:space-y-4">
              <h2 className="text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                <ShieldAlert className="size-3.5 md:size-4 text-amber-500" />
                等待审批 ({devices.pending.length})
              </h2>
              <div className="space-y-2">
                {devices.pending.map((req: PairRequest) => (
                  <Card key={req.requestId} className="p-3 md:p-4 bg-amber-500/5 border-amber-500/20">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 md:p-3 bg-amber-500/10 rounded-full text-amber-500 shrink-0">
                          <Smartphone className="size-4 md:size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{req.displayName || req.deviceId}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground font-mono truncate">{req.deviceId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs h-8" onClick={() => handleApprove(req.requestId)}>
                          批准
                        </Button>
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive text-xs h-8" onClick={() => handleReject(req.requestId)}>
                          拒绝
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Paired Devices */}
          <div className="space-y-3 md:space-y-4">
            <h2 className="text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">
              已授权设备 ({devices.paired.length})
            </h2>
            <div className="grid grid-cols-1 gap-2 md:gap-3">
              {devices.paired.length === 0 && (
                <div className="p-8 md:p-12 text-center rounded-xl lg:rounded-2xl bg-muted/10 opacity-60 border border-dashed">
                  <ShieldCheck className="size-10 md:size-12 mx-auto mb-3 md:mb-4 stroke-1" />
                  <p className="text-sm">无已授权设备</p>
                </div>
              )}
              {devices.paired.map((device: Device) => (
                <Card key={device.deviceId} className="p-3 md:p-4 lg:p-5 border-border/50 bg-background/30">
                  <div className="flex flex-col lg:flex-row gap-3 md:gap-4 lg:gap-6">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start gap-2 md:gap-3">
                        <div className="p-2 md:p-2.5 bg-primary/10 rounded-lg md:rounded-xl text-primary shrink-0">
                          <Smartphone className="size-4 md:size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm md:text-base">{device.displayName || "未知名称"}</h3>
                          <p className="text-[10px] md:text-xs text-muted-foreground font-mono truncate">{device.deviceId}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {device.roles?.map((role: string) => <Badge key={role} variant="outline" className="text-[9px] md:text-[10px]">{role}</Badge>)}
                        {device.scopes?.map((scope: string) => <Badge key={scope} variant="secondary" className="text-[9px] md:text-[10px] bg-muted/50">{scope}</Badge>)}
                      </div>
                    </div>

                    <div className="lg:w-[320px] xl:w-[400px] border-t lg:border-t-0 lg:border-l border-border/50 pt-3 lg:pt-0 lg:pl-4 xl:pl-6 space-y-2 md:space-y-3">
                      <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-tight flex items-center gap-1.5">
                        <Key className="size-3 md:size-3.5" />
                        权限令牌
                      </p>
                      <div className="space-y-1.5 md:space-y-2">
                        {device.tokens?.map((token: Token) => (
                          <div key={token.role} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs border border-border/30">
                            <span className="font-semibold text-[10px] md:text-xs truncate mr-2">{token.role}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant={token.revokedAtMs ? "destructive" : "success"} className="text-[9px] md:text-[10px] scale-75 md:scale-100 origin-right">
                                {token.revokedAtMs ? "已撤销" : "活跃"}
                              </Badge>
                              {!token.revokedAtMs && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground hover:text-destructive rounded-full"
                                  onClick={() => handleRevoke(device.deviceId, token.role)}
                                >
                                  <Trash2 className="size-2.5 md:size-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
