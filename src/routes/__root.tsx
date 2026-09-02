import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "sonner";
import { restore115Session } from "@/lib/server/fns";
import type { Pan115User } from "@/lib/types";
import appCss from "../styles.css?url";

const APP_NAME = "帧索 FrameSeek";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "中文视频语义检索工作台 — 多视图 embedding、115 网盘接入、可替换模型。" },
      { name: "theme-color", content: "#09090b" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUserStr = localStorage.getItem("frameseek_115_user");
      const savedCookie = localStorage.getItem("frameseek_pan115_cookie") || "";
      let user: Pan115User | undefined = undefined;
      if (savedUserStr) {
        try {
          user = JSON.parse(savedUserStr) as Pan115User;
        } catch {}
      }
      if (user || savedCookie) {
        void restore115Session({ data: { user, cookie: savedCookie } }).then(() => {
          // 凭证恢复完成后刷新依赖 Cookie 的查询（115 目录浏览、片库真实图拉取）
          void queryClient.invalidateQueries({ queryKey: ["115"] });
          void queryClient.invalidateQueries({ queryKey: ["videos"] });
          void queryClient.invalidateQueries({ queryKey: ["sources"] });
        });
      }
    }
  }, []);
  return (
    <html lang="zh-CN" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppShell>
              <Outlet />
            </AppShell>
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#121214",
                  border: "1px solid #27272a",
                  color: "#f4f4f5",
                },
              }}
            />
          </AuthProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
