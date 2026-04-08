import { createRef } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useChatHistoryStateWeb } from "@/hooks/chat/use-chat-history-state-web";
import type { ChatHistoryResponse, ChatMessage } from "@/lib/openclaw/chat-types";

function createClient(resolver: (params: { sessionKey: string; limit: number }) => Promise<ChatHistoryResponse>) {
  return {
    request: vi.fn((_method: string, params: { sessionKey: string; limit: number }) => resolver(params)),
  };
}

describe("useChatHistoryStateWeb", () => {
  it("keeps optimistic user messages that are not yet present in history", async () => {
    const client = createClient(async () => ({
      messages: [
        { id: "assistant-1", role: "assistant", text: "reply" },
      ],
    }));
    const toast = vi.fn();
    const scrollRef = createRef<HTMLDivElement>();
    scrollRef.current = { scrollHeight: 400, scrollTo: vi.fn() } as unknown as HTMLDivElement;

    const { result } = renderHook(() => useChatHistoryStateWeb({
      client: client as never,
      connected: true,
      toast,
      scrollRef,
    }));

    const optimistic: ChatMessage = {
      id: "user-1",
      role: "user",
      text: "hello",
      content: "hello",
      optimistic: true,
    };

    act(() => {
      result.current.appendOptimisticMessage(optimistic);
    });

    await act(async () => {
      await result.current.fetchHistory("main");
    });

    expect(result.current.messages).toEqual([
      { id: "assistant-1", role: "assistant", text: "reply" },
      optimistic,
    ]);
  });

  it("drops optimistic duplicates once matching history arrives", async () => {
    const client = createClient(async () => ({
      messages: [
        { id: "server-user-1", role: "user", text: "hello", content: "hello" },
        { id: "assistant-1", role: "assistant", text: "reply" },
      ],
    }));
    const toast = vi.fn();
    const scrollRef = createRef<HTMLDivElement>();
    scrollRef.current = { scrollHeight: 400, scrollTo: vi.fn() } as unknown as HTMLDivElement;

    const { result } = renderHook(() => useChatHistoryStateWeb({
      client: client as never,
      connected: true,
      toast,
      scrollRef,
    }));

    act(() => {
      result.current.appendOptimisticMessage({
        id: "optimistic-user-1",
        role: "user",
        text: "hello",
        content: "hello",
        optimistic: true,
      });
    });

    await act(async () => {
      await result.current.fetchHistory("main");
    });

    expect(result.current.messages).toEqual([
      { id: "server-user-1", role: "user", text: "hello", content: "hello" },
      { id: "assistant-1", role: "assistant", text: "reply" },
    ]);
  });

  it("dedupes concurrent history fetches for the same session", async () => {
    let resolveRequest: ((value: ChatHistoryResponse) => void) | null = null;
    const requestPromise = new Promise<ChatHistoryResponse>((resolve) => {
      resolveRequest = resolve;
    });
    const client = createClient(async () => requestPromise);
    const toast = vi.fn();
    const scrollRef = createRef<HTMLDivElement>();
    scrollRef.current = { scrollHeight: 400, scrollTo: vi.fn() } as unknown as HTMLDivElement;

    const { result } = renderHook(() => useChatHistoryStateWeb({
      client: client as never,
      connected: true,
      toast,
      scrollRef,
    }));

    let firstPromise: Promise<void>;
    let secondPromise: Promise<void>;

    await act(async () => {
      firstPromise = result.current.fetchHistory("main");
      secondPromise = result.current.fetchHistory("main");
      resolveRequest?.({ messages: [{ id: "assistant-1", role: "assistant", text: "reply" }] });
      await Promise.all([firstPromise!, secondPromise!]);
    });

    expect(client.request).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.messages).toEqual([{ id: "assistant-1", role: "assistant", text: "reply" }]);
    });
  });

  it("keeps multiple optimistic user messages with identical text until matching history count catches up", async () => {
    const client = createClient(async () => ({
      messages: [
        { id: "server-user-1", role: "user", text: "你好", content: "你好" },
      ],
    }));
    const toast = vi.fn();
    const scrollRef = createRef<HTMLDivElement>();
    scrollRef.current = { scrollHeight: 400, scrollTo: vi.fn() } as unknown as HTMLDivElement;

    const { result } = renderHook(() => useChatHistoryStateWeb({
      client: client as never,
      connected: true,
      toast,
      scrollRef,
    }));

    act(() => {
      result.current.appendOptimisticMessage({
        id: "optimistic-user-1",
        role: "user",
        text: "你好",
        content: "你好",
        optimistic: true,
      });
      result.current.appendOptimisticMessage({
        id: "optimistic-user-2",
        role: "user",
        text: "你好",
        content: "你好",
        optimistic: true,
      });
    });

    await act(async () => {
      await result.current.fetchHistory("main");
    });

    expect(result.current.messages).toEqual([
      { id: "server-user-1", role: "user", text: "你好", content: "你好" },
      {
        id: "optimistic-user-2",
        role: "user",
        text: "你好",
        content: "你好",
        optimistic: true,
      },
    ]);
  });
});
