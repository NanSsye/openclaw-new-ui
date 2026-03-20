"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
          <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">页面出现错误</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-md">
            {this.state.error?.message || "发生了未知错误"}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              返回首页
            </Button>
            <Button onClick={this.handleReset}>
              <RefreshCw className="size-4 mr-2" />
              重试
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
