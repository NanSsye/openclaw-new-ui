import {
  isToolDiagnosticText,
  normalizeMessageParts,
} from "@/lib/openclaw/chat-message-normalizer";

describe("chat-message-normalizer", () => {
  it("detects common tool diagnostic text patterns", () => {
    expect(isToolDiagnosticText("200")).toBe(true);
    expect(isToolDiagnosticText("Command still running (session abc, pid 123)")).toBe(true);
    expect(isToolDiagnosticText("23:OUTPUT_DIR = '/tmp/output'")).toBe(true);
    expect(isToolDiagnosticText("Loaded: loaded (/etc/systemd/system/cloudflared.service; enabled)")).toBe(true);
    expect(isToolDiagnosticText("回来了，已经恢复。")).toBe(false);
  });

  it("merges adjacent tool output text into the previous tool result part", () => {
    const parts = normalizeMessageParts([
      {
        type: "tool_result",
        name: "command",
        toolCallId: "tool-1",
        content: "base output",
      },
      {
        type: "text",
        text: "200",
      },
    ]);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: "tool_result",
      detail: "base output\n\n200",
    });
  });

  it("splits think blocks from plain text messages", () => {
    const parts = normalizeMessageParts("先说结论<think>内部思考</think>再补一句");

    expect(parts).toEqual([
      { type: "text", text: "先说结论" },
      { type: "thinking", text: "内部思考" },
      { type: "text", text: "再补一句" },
    ]);
  });
});
