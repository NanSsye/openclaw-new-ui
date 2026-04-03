import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundaryProvider from "@/components/error-boundary-client";

export const metadata: Metadata = {
  title: "OpenClaw New UI",
  description: "A premium, independent UI for OpenClaw.",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 在 HTML 渲染前设置主题，避免闪烁
  const themeScript = `(function(){try{var t=localStorage.getItem('openclaw.theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`;

  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased font-sans">
        <ErrorBoundaryProvider>
          {children}
          <Toaster />
        </ErrorBoundaryProvider>
      </body>
    </html>
  );
}
