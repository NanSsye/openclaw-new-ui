"use client";

import { useCallback } from "react";
import { generateUUID } from "@/lib/openclaw/uuid";
import type { GatewayClient } from "@/lib/openclaw/gateway-client";
import type { ChatMessage } from "@/lib/openclaw/chat-types";

export type ChatCommand = {
  name: string;
  label: string;
  description: string;
  args?: string;
  category: "session" | "model" | "tools" | "agents";
};

function buildCommandMessage(content: string): ChatMessage {
  return {
    id: generateUUID(),
    role: "user",
    content,
    attachments: [],
    createdAt: new Date().toISOString(),
  };
}

export function useChatCommands({
  client,
  activeSession,
  setMessages,
  setIsTyping,
  setInputText,
  setSelectedModel,
  toast,
}: {
  client: GatewayClient | null;
  activeSession: string;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsTyping: React.Dispatch<React.SetStateAction<boolean>>;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  const sendCommand = useCallback((content: string) => {
    const userMessage = buildCommandMessage(content);
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    client?.request("chat.send", {
      sessionKey: activeSession,
      message: content,
      idempotencyKey: userMessage.id,
    }).catch((error: unknown) => {
      setIsTyping(false);
      toast({
        title: "命令执行失败",
        description: error instanceof Error ? error.message : "命令执行失败",
        variant: "destructive",
      });
    });
  }, [activeSession, client, setIsTyping, setMessages, toast]);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    sendCommand(`/model ${modelId}`);
  }, [sendCommand, setSelectedModel]);

  const handleCommandClick = useCallback((cmd: ChatCommand) => {
    if (cmd.args) {
      setInputText(`/${cmd.name} `);
      setTimeout(() => {
        const input = document.querySelector("textarea");
        if (input instanceof HTMLTextAreaElement) {
          input.focus();
        }
      }, 50);
      return;
    }

    sendCommand(`/${cmd.name}`);
  }, [sendCommand, setInputText]);

  return {
    handleSelectModel,
    handleCommandClick,
    sendCommand,
  };
}
