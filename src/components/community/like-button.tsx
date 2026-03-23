"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LikeButtonProps = {
  liked?: boolean;
  count: number;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "default";
};

export function LikeButton({
  liked,
  count,
  onClick,
  disabled,
  size = "sm",
}: LikeButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full gap-2 text-muted-foreground hover:text-rose-500",
        liked && "text-rose-500 bg-rose-500/10 hover:bg-rose-500/15"
      )}
    >
      <Heart className={cn("size-4", liked && "fill-current")} />
      <span>{count}</span>
    </Button>
  );
}
