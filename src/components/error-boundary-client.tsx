"use client";

import { ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary";

export default function ErrorBoundaryProvider({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
