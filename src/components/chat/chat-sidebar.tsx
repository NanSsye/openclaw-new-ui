"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Terminal, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";

export function ChatSidebar({
  open,
  content,
  onClose,
}: {
  open: boolean;
  content: string | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-[500px] border-l bg-background/60 backdrop-blur-3xl flex flex-col z-30 shadow-2xl"
        >
          <div className="p-8 border-b flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-5">
              <div className="size-12 bg-primary/10 rounded-[1.2rem] flex items-center justify-center border border-primary/20">
                <Terminal className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest leading-tight">执行详情</h3>
                <p className="text-[10px] text-muted-foreground font-black opacity-40 mt-1 uppercase tracking-tighter">报文分析控制台</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-destructive/10 hover:text-destructive">
              <XCircle className="size-7 stroke-[1.5]" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ""}</ReactMarkdown>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
