"use client";

import { Loader2, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReplyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

export function ReplyEditor({ value, onChange, onSubmit, submitting }: ReplyEditorProps) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 p-3 shadow-sm sm:p-4 md:p-5">
      <div className="space-y-2.5 sm:space-y-3">
        <div>
          <h3 className="text-sm font-bold sm:text-base">参与回复</h3>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">分享你的看法、经验或解决方案。</p>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="写下你的回复内容..."
          rows={4}
          className="flex w-full rounded-[1.2rem] border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4 sm:py-3"
        />
        <div className="flex justify-end">
          <Button size="sm" className="rounded-full px-4 text-sm" onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
            发送回复
          </Button>
        </div>
      </div>
    </div>
  );
}
