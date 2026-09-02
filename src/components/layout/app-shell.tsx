import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Aperture,
  Clapperboard,
  Cpu,
  FolderInput,
  GitBranch,
  Search,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "检索", icon: Search },
  { to: "/library", label: "片库", icon: Clapperboard },
  { to: "/sources", label: "115接入", icon: FolderInput },
  { to: "/pipeline", label: "流水线", icon: GitBranch },
  { to: "/models", label: "模型", icon: Cpu },
  { to: "/workflow", label: "工作流", icon: Workflow },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* 桌面端侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface md:flex">
        <Link to="/" className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Aperture className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="font-display text-xl font-bold leading-none tracking-tight">帧锁</div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.22em] text-accent">FRAMESEEK</div>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-accent/10 text-accent font-semibold"
                    : "text-muted hover:bg-elevated/70 hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.6} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="rounded-xl border border-border bg-elevated/40 p-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-[10px] font-semibold text-fg">Qwen3-VL 8B</span>
            </div>
            <p className="mt-1 text-[11px] text-subtle">多视图特征检索已就绪</p>
          </div>
        </div>
      </aside>

      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <Aperture className="h-5 w-5 text-accent" strokeWidth={1.75} />
          <span className="font-display text-lg font-bold">帧锁</span>
        </Link>
        <span className="font-mono text-[10px] tracking-widest text-accent">FRAMESEEK</span>
      </header>

      {/* 主内容区域 */}
      <main className="md:pl-60">
        <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-8">{children}</div>
      </main>

      {/* 移动端底栏导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {NAV.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px]",
                active ? "font-medium text-accent" : "text-subtle",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.6} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
