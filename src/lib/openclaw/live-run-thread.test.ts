import { buildLiveRunListData } from "@/lib/openclaw/live-run-thread";
import type { ChatMessage } from "@/lib/openclaw/chat-types";

describe("buildLiveRunListData", () => {
  it("appends diagnostic assistant output to the previous tool card", () => {
    const historyMessages: ChatMessage[] = [
      {
        id: "assistant-tool-call",
        role: "assistant",
        content: [
          {
            type: "tool_call",
            name: "command",
            arguments: { command: "curl -I https://example.com" },
            toolCallId: "tool-1",
          },
        ],
      },
      {
        id: "assistant-tool-output",
        role: "assistant",
        text: "200",
        content: "200",
      },
      {
        id: "assistant-followup",
        role: "assistant",
        text: "回来了，服务已经恢复。",
        content: "回来了，服务已经恢复。",
      },
    ];

    const result = buildLiveRunListData({
      historyMessages,
      toolMessages: [],
      streamSegments: [],
      liveStreamText: null,
      liveStreamStartedAt: null,
      activeRunId: null,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      role: "tool",
      toolName: "command",
      toolStatus: "success",
      toolDetail: "200",
    });
    expect(result[1]).toMatchObject({
      role: "assistant",
      text: "回来了，服务已经恢复。",
    });
  });

  it("splits tool narration so assistant follow-up stays outside the tool card", () => {
    const historyMessages: ChatMessage[] = [
      {
        id: "tool-1",
        role: "tool",
        name: "command",
        text: "Command curl -I https://example.com",
        content: "HTTP/1.1 200 OK\n\n回来了，网站已经恢复。",
      },
    ];

    const result = buildLiveRunListData({
      historyMessages,
      toolMessages: [],
      streamSegments: [],
      liveStreamText: null,
      liveStreamStartedAt: null,
      activeRunId: null,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      role: "tool",
      toolName: "command",
      toolDetail: "HTTP/1.1 200 OK",
    });
    expect(result[1]).toMatchObject({
      role: "assistant",
      text: "回来了，网站已经恢复。",
    });
  });

  it("keeps transient streaming text out once a terminal assistant message already exists", () => {
    const historyMessages: ChatMessage[] = [
      {
        id: "final_run-1",
        role: "assistant",
        text: "最终回答",
        content: "最终回答",
      },
    ];

    const result = buildLiveRunListData({
      historyMessages,
      toolMessages: [],
      streamSegments: [],
      liveStreamText: "这段不应该再显示",
      liveStreamStartedAt: Date.now(),
      activeRunId: "run-1",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "assistant",
      text: "最终回答",
    });
  });

  it("upgrades a matching tool call to success when the result arrives", () => {
    const historyMessages: ChatMessage[] = [
      {
        id: "assistant-tool",
        role: "assistant",
        content: [
          {
            type: "tool_call",
            name: "command",
            arguments: { command: "echo hello" },
            toolCallId: "tool-1",
          },
          {
            type: "tool_result",
            name: "command",
            toolCallId: "tool-1",
            content: "hello",
          },
        ],
      },
    ];

    const result = buildLiveRunListData({
      historyMessages,
      toolMessages: [],
      streamSegments: [],
      liveStreamText: null,
      liveStreamStartedAt: null,
      activeRunId: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "tool",
      id: "tool-1",
      toolStatus: "success",
      toolName: "command",
      toolDetail: "hello",
    });
  });

  it("settles a running tool when history only contains diagnostic output and a later assistant reply", () => {
    const historyMessages: ChatMessage[] = [
      {
        id: "assistant-tool-call",
        role: "assistant",
        content: [
          {
            type: "tool_call",
            name: "command",
            arguments: { command: "ffmpeg -i input.jpg output.mp4" },
            toolCallId: "tool-ffmpeg-1",
          },
        ],
      },
      {
        id: "assistant-tool-output",
        role: "assistant",
        text: "(no output)",
        content: "(no output)",
      },
      {
        id: "assistant-followup",
        role: "assistant",
        text: "来了👇",
        content: "来了👇",
      },
    ];

    const result = buildLiveRunListData({
      historyMessages,
      toolMessages: [],
      streamSegments: [],
      liveStreamText: null,
      liveStreamStartedAt: null,
      activeRunId: null,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      role: "tool",
      id: "tool-ffmpeg-1",
      toolStatus: "success",
      toolDetail: "(no output)",
    });
    expect(result[1]).toMatchObject({
      role: "assistant",
      text: "来了👇",
    });
  });
});
