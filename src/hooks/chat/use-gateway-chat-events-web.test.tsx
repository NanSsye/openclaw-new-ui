import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useGatewayChatEventsWeb } from "@/hooks/chat/use-gateway-chat-events-web";
import type { GatewayEventFrame } from "@/lib/openclaw/gateway-client";
import type { SessionItem, SessionUsage } from "@/lib/openclaw/chat-types";
import type { StreamSegment, ToolTransientMessage } from "@/lib/openclaw/live-run-thread";

function createClient() {
  return {
    setOnEvent: vi.fn(),
  };
}

function renderEventsHook() {
  const client = createClient();
  const fetchHistory = vi.fn(async () => {});
  const invalidateHistory = vi.fn();
  const fetchSessions = vi.fn(async () => {});
  const stopPolling = vi.fn();
  const clearTransient = vi.fn();
  const toast = vi.fn();

  const hook = renderHook(() => {
    const [chatStream, setChatStream] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [sessionUsage, setSessionUsage] = useState<SessionUsage | null>(null);
    const [sessions, setSessions] = useState<SessionItem[]>([{ key: "main" }]);
    const [streamSegments, setStreamSegments] = useState<StreamSegment[]>([]);
    const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
    const [toolMessages, setToolMessages] = useState<ToolTransientMessage[]>([]);

    useGatewayChatEventsWeb({
      client: client as never,
      activeSession: "main",
      clearTransient,
      fetchHistory,
      invalidateHistory,
      fetchSessions,
      setChatStream,
      setIsTyping,
      setSessionUsage,
      setSessions,
      setStreamSegments,
      setStreamStartedAt,
      setToolMessages,
      stopPolling,
      toast,
    });

    return {
      chatStream,
      isTyping,
      sessionUsage,
      sessions,
      streamSegments,
      streamStartedAt,
      toolMessages,
    };
  });

  const eventHandler = client.setOnEvent.mock.calls.at(-1)?.[0] as ((evt: GatewayEventFrame) => void) | undefined;
  if (!eventHandler) {
    throw new Error("Expected event handler to be registered");
  }

  return {
    hook,
    client,
    fetchHistory,
    invalidateHistory,
    fetchSessions,
    stopPolling,
    clearTransient,
    toast,
    eventHandler,
  };
}

describe("useGatewayChatEventsWeb", () => {
  it("updates live writing state on text delta events", () => {
    const { hook, eventHandler } = renderEventsHook();

    act(() => {
      eventHandler({
        type: "event",
        event: "chat",
        payload: {
          state: "delta",
          sessionKey: "main",
          message: {
            content: [{ type: "text", text: "hello world" }],
          },
        },
      });
    });

    expect(hook.result.current.isTyping).toBe(true);
    expect(hook.result.current.chatStream).toBe("hello world");
  });

  it("forces one recovery fetch for matching final and after-final events", () => {
    vi.useFakeTimers();
    const {
      eventHandler,
      fetchHistory,
      invalidateHistory,
      fetchSessions,
      stopPolling,
      clearTransient,
    } = renderEventsHook();

    const finalFrame: GatewayEventFrame = {
      type: "event",
      event: "chat",
      payload: {
        state: "final",
        sessionKey: "main",
        message: { id: "msg-1", runId: "run-1" },
      },
    };
    const afterFinalFrame: GatewayEventFrame = {
      type: "event",
      event: "chat",
      payload: {
        state: "after-final",
        sessionKey: "main",
        message: { id: "msg-1", runId: "run-1" },
      },
    };

    act(() => {
      eventHandler(finalFrame);
      eventHandler(afterFinalFrame);
      vi.advanceTimersByTime(300);
    });

    expect(stopPolling).toHaveBeenCalledTimes(2);
    expect(clearTransient).toHaveBeenCalledTimes(2);
    expect(invalidateHistory).toHaveBeenCalledTimes(1);
    expect(invalidateHistory).toHaveBeenCalledWith("main");
    expect(fetchHistory).toHaveBeenCalledTimes(1);
    expect(fetchHistory).toHaveBeenCalledWith("main", true);
    expect(fetchSessions).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("updates usage from delta events", () => {
    const { hook, eventHandler } = renderEventsHook();

    act(() => {
      eventHandler({
        type: "event",
        event: "chat",
        payload: {
          state: "delta",
          sessionKey: "main",
          usage: { input: 12, output: 34 },
          message: { content: [{ type: "text", text: "partial" }] },
        },
      });
    });

    expect(hook.result.current.sessionUsage).toEqual({ input: 12, output: 34 });
    expect(hook.result.current.sessions).toEqual([{ key: "main", usage: { input: 12, output: 34 } }]);
  });
});
