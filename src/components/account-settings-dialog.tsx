"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Shield,
  Activity,
  Save,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AccountSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("connection");

  // Connection settings state
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");

  // Load saved settings when dialog opens
  useEffect(() => {
    if (open) {
      const rawSettings = localStorage.getItem("openclaw.control.settings.v1");
      const savedToken = localStorage.getItem("openclaw.control.token.v1");
      if (rawSettings) {
        try {
          const settings = JSON.parse(rawSettings);
          setGatewayUrl(settings.gatewayUrl || "");
        } catch {}
      }
      setGatewayToken(savedToken || "");
    }
  }, [open]);

  const tabs = [
    { id: "connection", label: "网关连接", icon: Globe },
    { id: "security", label: "安全中心", icon: Shield },
    { id: "advanced", label: "高级功能", icon: Activity },
  ];

  const handleApply = () => {
    // Save settings back to localStorage
    const rawSettings = localStorage.getItem("openclaw.control.settings.v1");
    const settings = rawSettings ? JSON.parse(rawSettings) : {};
    settings.gatewayUrl = gatewayUrl;
    localStorage.setItem("openclaw.control.settings.v1", JSON.stringify(settings));
    if (gatewayToken) {
      localStorage.setItem("openclaw.control.token.v1", gatewayToken);
      sessionStorage.setItem("openclaw.control.token.v1", gatewayToken);
    }

    toast({
      title: "设置已保存",
      description: "您的连接和安全设置已更新。即将尝试重新连接网关。",
    });
    onOpenChange(false);
  };

  const ActiveIcon = tabs.find((t) => t.id === activeTab)?.icon || Globe;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden rounded-2xl border border-border/50 shadow-2xl max-h-[90vh] max-w-full w-full sm:max-w-2xl sm:h-[550px] sm:max-h-[85vh] [&>button]:hidden">
        <DialogTitle className="sr-only">账户设置</DialogTitle>

        {/* Mobile Header with Dropdown and Close */}
        <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ActiveIcon className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{tabs.find((t) => t.id === activeTab)?.label}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {tabs.map((tab) => (
                  <DropdownMenuItem
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn("cursor-pointer", activeTab === tab.id && "bg-primary/10")}
                  >
                    <tab.icon className="size-4 mr-2 opacity-60" />
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg shrink-0" onClick={() => onOpenChange(false)}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground">
              <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
            </svg>
          </Button>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden sm:flex w-full h-full">
          <div className="w-[200px] border-r border-border/50 bg-muted/20 p-6 flex flex-col gap-6">
            <div className="select-none">
              <h3 className="font-bold text-lg tracking-tight text-foreground">偏好设置</h3>
              <p className="text-xs text-muted-foreground mt-1">全局选项与控制面板</p>
            </div>
            <div className="flex flex-col gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-all font-medium",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-background relative">
            {activeTab === "connection" && (
              <div className="space-y-6 pb-20">
                <div>
                  <h4 className="text-xl font-bold tracking-tight mb-2">连接配置</h4>
                  <p className="text-sm text-muted-foreground">修改当前连接的网关底层通信参数。修改并应用后会重新连接网关实例。</p>
                </div>
                <div className="space-y-4 max-w-sm">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gateway 地址</Label>
                    <Input
                      value={gatewayUrl}
                      onChange={(e) => setGatewayUrl(e.target.value)}
                      placeholder="wss://example.com:18789"
                      className="font-mono text-sm bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">通讯鉴权口令 (Token)</Label>
                    <Input
                      value={gatewayToken}
                      onChange={(e) => setGatewayToken(e.target.value)}
                      type="password"
                      placeholder="输入访问密钥"
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">连接协议 (Protocol)</Label>
                    <Input value="v2026.3.11" className="font-mono text-sm bg-muted/50" disabled />
                    <p className="text-[10px] text-muted-foreground">此参数为当前客户端硬编码强制绑定的版本。</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6 pb-20">
                <div>
                  <h4 className="text-xl font-bold tracking-tight mb-2">安全中心</h4>
                  <p className="text-sm text-muted-foreground">管理您的存储凭据、登录行为和设备安全配置。</p>
                </div>
                <div className="space-y-4 max-w-md">
                  <div className="p-5 bg-muted/20 rounded-2xl border border-border/50 space-y-4">
                    <div className="font-medium">会话缓存持有期</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">如果关闭此项，退出浏览器或刷新后将强制清除所有本地令牌和聊天上下文记录，增强隐私性。</p>
                    <Button variant="outline" size="sm" className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10">清除当前所有缓存</Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "advanced" && (
              <div className="space-y-6 pb-20">
                <div>
                  <h4 className="text-xl font-bold tracking-tight mb-2">高级功能</h4>
                  <p className="text-sm text-muted-foreground">修改一些底层特性。需具备网关的特权操作权限。</p>
                </div>
                <div className="space-y-4 max-w-md">
                  <div className="p-5 bg-orange-500/5 rounded-2xl border border-orange-500/20 space-y-4">
                    <div className="font-medium text-orange-600 dark:text-orange-400">开发者模式 (Debug Layer)</div>
                    <p className="text-sm text-orange-600/70 dark:text-orange-400/70 leading-relaxed">允许在控制台打印原始心跳包、WebSocket 握手握签以及错误堆栈日志。</p>
                    <Button variant="outline" size="sm" className="rounded-xl border-orange-500/30 text-orange-600 hover:bg-orange-500/10">启用 Debug Mode</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Action Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-background/80 backdrop-blur-md border-t border-border/50 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl px-6">取消</Button>
              <Button onClick={handleApply} className="rounded-xl px-8 shadow-lg shadow-primary/20 gap-2">
                <Save className="size-4" /> 应用修改
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Content */}
        <div className="sm:hidden flex-1 overflow-y-auto p-4 bg-background">
          {activeTab === "connection" && (
            <div className="space-y-6 pb-20">
              <div>
                <h4 className="text-lg font-bold tracking-tight mb-2">连接配置</h4>
                <p className="text-sm text-muted-foreground">修改当前连接的网关底层通信参数。</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gateway 地址</Label>
                  <Input
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                    placeholder="wss://example.com:18789"
                    className="font-mono text-sm bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">通讯鉴权口令 (Token)</Label>
                  <Input
                    value={gatewayToken}
                    onChange={(e) => setGatewayToken(e.target.value)}
                    type="password"
                    placeholder="输入访问密钥"
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">连接协议 (Protocol)</Label>
                  <Input value="v2026.3.11" className="font-mono text-sm bg-muted/50" disabled />
                  <p className="text-[10px] text-muted-foreground">此参数为当前客户端硬编码强制绑定的版本。</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6 pb-20">
              <div>
                <h4 className="text-lg font-bold tracking-tight mb-2">安全中心</h4>
                <p className="text-sm text-muted-foreground">管理您的存储凭据、登录行为和设备安全配置。</p>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-4">
                  <div className="font-medium">会话缓存持有期</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">如果关闭此项，退出浏览器或刷新后将强制清除所有本地令牌和聊天上下文记录，增强隐私性。</p>
                  <Button variant="outline" size="sm" className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10">清除当前所有缓存</Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="space-y-6 pb-20">
              <div>
                <h4 className="text-lg font-bold tracking-tight mb-2">高级功能</h4>
                <p className="text-sm text-muted-foreground">修改一些底层特性。需具备网关的特权操作权限。</p>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/20 space-y-4">
                  <div className="font-medium text-orange-600 dark:text-orange-400">开发者模式 (Debug Layer)</div>
                  <p className="text-sm text-orange-600/70 dark:text-orange-400/70 leading-relaxed">允许在控制台打印原始心跳包、WebSocket 握手握签以及错误堆栈日志。</p>
                  <Button variant="outline" size="sm" className="rounded-xl border-orange-500/30 text-orange-600 hover:bg-orange-500/10">启用 Debug Mode</Button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t border-border/50 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl px-4">取消</Button>
            <Button onClick={handleApply} className="rounded-xl px-6 gap-2">
              <Save className="size-4" /> 应用修改
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
