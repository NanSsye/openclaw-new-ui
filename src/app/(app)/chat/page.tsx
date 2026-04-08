"use client";

import { useSyncExternalStore, type ComponentType } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  BarChart2,
  Book,
  Bot,
  Box,
  Brain,
  ChevronDown,
  Download,
  Monitor,
  Plus,
  RotateCcw,
  StopCircle,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatContextMonitor } from "@/components/chat/chat-context-monitor";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatToolbar } from "@/components/chat/chat-toolbar";
import { ChatUiMessageItem } from "@/components/chat/chat-ui-message-item";
import { useGateway } from "@/context/gateway-context";
import { useChatControllerWeb } from "@/hooks/chat/use-chat-controller-web";
import type { ChatCommand } from "@/hooks/use-chat-commands";
import { useToast } from "@/hooks/use-toast";

type SlashCommand = ChatCommand & { icon: ComponentType<{ className?: string }> };

const SLASH_COMMANDS: SlashCommand[] = [
  { name: "new", label: "新建会话", description: "开启一个全新的对话上下文", category: "session", icon: Plus },
  { name: "reset", label: "重置会话", description: "重置当前会话的上下文", category: "session", icon: RotateCcw },
  { name: "compact", label: "压缩上下文", description: "压缩当前对话的上下文以节省 Token", category: "session", icon: Box },
  { name: "clear", label: "清空历史", description: "清空当前页面的聊天记录", category: "session", icon: Trash2 },
  { name: "stop", label: "停止生成", description: "由于网关限制，此命令可能部分失效", category: "session", icon: StopCircle },
  { name: "model", label: "切换模型", description: "查看或设置当前使用的模型", args: "<name>", category: "model", icon: Brain },
  { name: "think", label: "思考等级", description: "设置模型思考深度 (off/low/mid/high)", args: "<level>", category: "model", icon: Brain },
  { name: "fast", label: "快速模式", description: "切换是否开启快速响应模式", args: "<on|off>", category: "model", icon: Zap },
  { name: "verbose", label: "详细输出", description: "调试模式：输出更多中间过程", args: "<on|off>", category: "model", icon: Terminal },
  { name: "status", label: "运行状态", description: "查看当前网关及会话健康度", category: "tools", icon: BarChart },
  { name: "usage", label: "用量统计", description: "查看当前 Token 消耗概览", category: "tools", icon: BarChart2 },
  { name: "help", label: "查看帮助", description: "显示所有可用的命令列表", category: "tools", icon: Book },
  { name: "export", label: "导出对话", description: "将对话导出为 Markdown 文件", category: "tools", icon: Download },
  { name: "agents", label: "智能体列表", description: "列出当前活跃的所有子智能体", category: "agents", icon: Monitor },
  { name: "kill", label: "终止智能体", description: "强制停止特定的子智能体运行", args: "<id|all>", category: "agents", icon: X },
  { name: "skill", label: "运行技能", description: "直接调用特定的插件技能", args: "<name>", category: "agents", icon: Zap },
];

export default function ChatPage() {
  const { connected, client, health } = useGateway();
  const { toast } = useToast();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const controllerHealth = health
    ? {
        contextWeight: (health as { contextWeight?: unknown }).contextWeight,
        contextLimit: (health as { contextLimit?: unknown }).contextLimit,
      }
    : null;

  const controller = useChatControllerWeb({
    client,
    connected,
    health: controllerHealth,
    toast,
    mounted,
  });
  const {
    mounted: controllerMounted,
    agents,
    inputText,
    setInputText,
    isTyping,
    displayMessages,
    showScrollButton,
    activeSession,
    activeSessionData,
    sessions,
    models,
    selectedModel,
    showDetails,
    usageLoading,
    pendingAttachments,
    fileInputRef,
    isDragging,
    isRecording,
    sidebarOpen,
    sidebarContent,
    totalTokens,
    contextLimit,
    scrollRef,
    bottomRef,
    setSidebarOpen,
    setIsUsageDropdownOpen,
    handleOpenSidebar,
    handleSend,
    handleSwitchSession,
    handleNewSession,
    handleSelectModel,
    handleCommandClick,
    toggleDetails,
    scrollToBottom,
    handleFileSelect,
    handleAttachmentsDrop,
    handleDragOver,
    handleDragLeave,
    removeFile,
    onToggleRecording,
  } = controller;

  return (
    <div className="flex h-full overflow-hidden bg-muted/5">
      <ChatContextMonitor
        mounted={controllerMounted}
        portalId="header-context-monitor-portal"
        totalTokens={totalTokens}
        contextLimit={contextLimit}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative flex h-full flex-1 flex-col overflow-hidden"
      >
        <div ref={scrollRef} className="custom-scrollbar flex-1 overflow-y-auto scroll-smooth px-2 py-4 sm:px-4 sm:py-8">
          <div className="mx-auto max-w-4xl space-y-8 pb-32 sm:space-y-12 sm:pb-40">
            {displayMessages.length === 0 && !isTyping && (
              <div className="h-full select-none pt-40 text-center text-muted-foreground opacity-20">
                <div className="flex flex-col items-center justify-center">
                  <Bot className="mb-6 size-32 stroke-[0.5]" />
                  <div className="text-center font-black uppercase tracking-[0.3em]">
                    <p className="text-2xl">OpenClaw Mesh</p>
                    <p className="mt-2 text-[10px] opacity-60">Gateway Connection Established</p>
                  </div>
                </div>
              </div>
            )}

            {displayMessages.map((message, index) => (
              <ChatUiMessageItem
                key={`${message.id || index}`}
                message={message}
                agents={agents}
                showDetails={showDetails}
                onOpenSidebar={handleOpenSidebar}
              />
            ))}

            {isTyping && (
              <div className="flex items-start gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-[1.2rem] border border-primary/10 bg-primary/5">
                  <div className="relative">
                    <Bot className="size-6 animate-pulse text-primary" />
                    <div className="absolute -inset-1 animate-ping rounded-full bg-primary/20 blur-sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex w-fit gap-1.5 rounded-[1.5rem] border border-border/40 bg-muted/10 p-4">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="size-1.5 rounded-full bg-primary/30" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="size-1.5 rounded-full bg-primary/30" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="size-1.5 rounded-full bg-primary/30" />
                  </div>
                  <p className="pl-2 text-[10px] font-black uppercase tracking-widest text-primary/40 animate-pulse">
                    OpenClaw is thinking...
                  </p>
                </div>
              </div>
            )}

            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
          className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/90 to-transparent p-3 pt-8 sm:p-8 sm:pt-12"
        >
          <div className="pointer-events-auto relative mx-auto max-w-4xl">
            {showScrollButton && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollToBottom}
                  className="size-7 shrink-0 rounded-full border-border/50 bg-background/80 px-0 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:scale-105"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
            )}

            <motion.div layout>
                <ChatToolbar
                models={models}
                selectedModel={selectedModel}
                onSelectModel={handleSelectModel}
                activeSession={activeSession}
                activeSessionData={activeSessionData}
                sessions={sessions}
                onNewSession={handleNewSession}
                onSwitchSession={handleSwitchSession}
                commands={SLASH_COMMANDS}
                onCommandClick={handleCommandClick}
                onUsageDropdownOpenChange={setIsUsageDropdownOpen}
                usageLoading={usageLoading}
                showDetails={showDetails}
                onToggleDetails={toggleDetails}
              />
            </motion.div>
          </div>

          <div className="pointer-events-auto mx-auto max-w-4xl">
            <ChatComposer
              pendingAttachments={pendingAttachments}
              onRemoveAttachment={removeFile}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleAttachmentsDrop}
              isRecording={isRecording}
              onToggleRecording={onToggleRecording}
              inputText={inputText}
              onInputChange={(event) => setInputText(event.target.value)}
              onSend={handleSend}
              connected={connected}
              isTyping={isTyping}
            />
          </div>
        </motion.div>

        <ChatSidebar
          open={sidebarOpen}
          content={sidebarContent}
          onClose={() => setSidebarOpen(false)}
        />
      </motion.div>
    </div>
  );
}
