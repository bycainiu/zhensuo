import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert, HelpCircle } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">页面加载发生异常</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "发生未知错误，请刷新页面或重试。"}
      </p>
      <Link to="/" className="mt-2 text-xs text-accent underline hover:underline">
        返回首页
      </Link>
    </main>
  );
}

export function AppNotFoundComponent() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center text-fg">
      <span className="text-muted" aria-hidden="true">
        <HelpCircle className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">未找到请求的页面</h1>
      <p className="max-w-md text-sm text-muted">该路由或资源不存在。</p>
      <Link to="/" className="mt-2 text-xs text-accent underline hover:underline">
        返回首页
      </Link>
    </main>
  );
}
