"use client";

import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { generateUUID } from "@/lib/openclaw/uuid";
import {
  type ChatAttachment,
  type PendingAttachment,
  uploadChatAttachment,
} from "@/lib/openclaw/chat-attachments";
import type { GatewayClient } from "@/lib/openclaw/gateway-client";
import type { ChatMessage, ChatSendResponse } from "@/lib/openclaw/chat-types";

function createOptimisticMessage(text: string, pendingAttachments: PendingAttachment[]): ChatMessage {
  return {
    id: generateUUID(),
    role: "user",
    content: text,
    attachments: pendingAttachments.map((attachment) => ({
      id: attachment.localId,
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.previewUrl || "",
      durationMs: attachment.durationMs,
    })),
    createdAt: new Date().toISOString(),
  };
}

async function uploadPendingAttachments(activeSession: string, pendingAttachments: PendingAttachment[]) {
  return Promise.all(
    pendingAttachments.map((attachment) =>
      uploadChatAttachment(attachment.file, activeSession, { durationMs: attachment.durationMs }),
    ),
  );
}

function revokeAttachmentPreviewUrls(attachments: PendingAttachment[]) {
  attachments.forEach((attachment) => {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  });
}

export function useChatSend({
  client,
  connected,
  activeSession,
  inputText,
  pendingAttachments,
  buildAttachmentPrompt,
  clearPendingAttachments,
  setMessages,
  setInputText,
  setIsTyping,
  setStreamingMessage,
  setStreamingMessages,
  startPolling,
  stopPolling,
  currentRunIdRef,
  toast,
}: {
  client: GatewayClient | null;
  connected: boolean;
  activeSession: string;
  inputText: string;
  pendingAttachments: PendingAttachment[];
  buildAttachmentPrompt: (attachments: ChatAttachment[]) => string;
  clearPendingAttachments: () => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  setIsTyping: React.Dispatch<React.SetStateAction<boolean>>;
  setStreamingMessage: React.Dispatch<React.SetStateAction<ChatMessage | null>>;
  setStreamingMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  startPolling: () => void;
  stopPolling: () => void;
  currentRunIdRef: MutableRefObject<string>;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  return useCallback(async () => {
    if ((!inputText.trim() && pendingAttachments.length === 0) || !client || !connected) return;

    const text = inputText.trim();
    const optimisticMessage = createOptimisticMessage(text, pendingAttachments);
    const attachmentsToUpload = [...pendingAttachments];

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText("");
    setIsTyping(true);
    setStreamingMessage(null);
    setStreamingMessages([]);
    clearPendingAttachments();

    try {
      const uploadedAttachments = await uploadPendingAttachments(activeSession, attachmentsToUpload);
      const attachmentPrompt = buildAttachmentPrompt(uploadedAttachments);
      const finalMessage = attachmentPrompt ? `${attachmentPrompt}\n\n${text}`.trim() : text;

      startPolling();

      const sendRes = await client.request<ChatSendResponse>("chat.send", {
        sessionKey: activeSession,
        message: finalMessage,
        idempotencyKey: optimisticMessage.id,
        attachments: uploadedAttachments,
      });

      if (sendRes?.runId) {
        currentRunIdRef.current = sendRes.runId;
        console.log("[Chat] Captured runId:", sendRes.runId);
      }
    } catch (error: unknown) {
      stopPolling();
      setIsTyping(false);
      setStreamingMessage(null);
      toast({
        title: "发送失败",
        description: error instanceof Error ? error.message : "消息发送失败",
        variant: "destructive",
      });
    } finally {
      revokeAttachmentPreviewUrls(attachmentsToUpload);
    }
  }, [
    activeSession,
    buildAttachmentPrompt,
    clearPendingAttachments,
    client,
    connected,
    currentRunIdRef,
    inputText,
    pendingAttachments,
    setInputText,
    setIsTyping,
    setMessages,
    setStreamingMessage,
    setStreamingMessages,
    startPolling,
    stopPolling,
    toast,
  ]);
}
