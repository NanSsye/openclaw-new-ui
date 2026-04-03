"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppUpdate, ReleaseInfo } from "@/hooks/use-app-update";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  RefreshCw,
  Rocket,
  Calendar,
  FileArchive,
  X,
} from "lucide-react";
import { useEffect } from "react";

interface AppUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRelease?: ReleaseInfo | null;
}

export function AppUpdateDialog({
  open,
  onOpenChange,
  initialRelease,
}: AppUpdateDialogProps) {
  const { state, checkForUpdate, downloadUpdate, reset } = useAppUpdate();
  const { toast } = useToast();

  useEffect(() => {
    if (open && !initialRelease && state.status === "idle") {
      checkForUpdate();
    }
  }, [open, initialRelease, state.status, checkForUpdate]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleDownload = async () => {
    await downloadUpdate();
    toast({
      title: "开始下载",
      description: "下载完成后会自动打开安装界面",
    });
  };

  const renderContent = () => {
    // 正在检测
    if (state.status === "checking") {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <RefreshCw className="size-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">正在检查更新...</p>
        </div>
      );
    }

    // 无更新
    if (state.status === "no-update") {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <Rocket className="size-8 text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">已是最新版本</p>
            <p className="text-sm text-muted-foreground mt-1">
              当前版本没有可用的更新
            </p>
          </div>
        </div>
      );
    }

    // 有更新
    if (state.status === "available" && state.release) {
      const release = state.release;
      return (
        <div className="space-y-6">
          {/* 版本信息 */}
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Rocket className="size-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">发现新版本</h3>
                <Badge variant="secondary" className="font-mono">
                  v{release.version}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {release.tagName}
              </p>
            </div>
          </div>

          {/* 更新信息 */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              <span>{formatDate(release.publishedAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileArchive className="size-3.5" />
              <span>{formatFileSize(release.fileSize)}</span>
            </div>
          </div>

          {/* 更新日志 */}
          {release.body && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-foreground">更新内容</h4>
              <div className="p-4 bg-muted/30 rounded-xl border border-border/50 max-h-48 overflow-y-auto">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {release.body}
                </pre>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={handleClose}
            >
              稍后再说
            </Button>
            <Button className="flex-1 rounded-xl gap-2" onClick={handleDownload}>
              <Download className="size-4" />
              下载安装
            </Button>
          </div>

          {/* 外部链接提示 */}
          <p className="text-xs text-muted-foreground text-center">
            将在浏览器中打开下载页面
          </p>
        </div>
      );
    }

    // 错误状态
    if (state.status === "error") {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <X className="size-8 text-destructive" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-destructive">检查更新失败</p>
            <p className="text-sm text-muted-foreground mt-1">
              {state.error || "请稍后再试"}
            </p>
          </div>
          <Button variant="outline" onClick={checkForUpdate} className="gap-2">
            <RefreshCw className="size-4" />
            重试
          </Button>
        </div>
      );
    }

    // 下载中
    if (state.status === "downloading") {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <RefreshCw className="size-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">正在下载更新...</p>
        </div>
      );
    }

    // 就绪
    if (state.status === "ready") {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <FileArchive className="size-8 text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">请安装 APK</p>
            <p className="text-sm text-muted-foreground mt-1">
              下载完成后请安装更新
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleClose}
            className="gap-2"
          >
            完成
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0 overflow-hidden rounded-2xl border border-border/50 shadow-2xl max-h-[85vh] max-w-full w-full sm:max-w-md [&>button]:hidden">
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 size-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors z-10"
        >
          <X className="size-4 text-muted-foreground" />
        </button>

        <div className="p-6">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}
