"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type MobileBottomSheetContentProps = React.HTMLAttributes<HTMLDivElement>;

export const MobileBottomSheetContent = React.forwardRef<HTMLDivElement, MobileBottomSheetContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain] [-webkit-overflow-scrolling:touch]",
        className,
      )}
      {...props}
    />
  ),
);

MobileBottomSheetContent.displayName = "MobileBottomSheetContent";
