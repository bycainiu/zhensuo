import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listVideos } from "@/lib/server/fns";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatClock } from "@/lib/utils";

export const Route = createFileRoute("/library")({ component: LibraryPage });

function LibraryPage() {
  const q = useQuery({ queryKey: ["videos"], queryFn: () => listVideos() });
  const videos = q.data ?? [];
  const ready = videos.filter((v) => v.status === "ready");
  const pending = videos.filter((v) => v.status !== "ready");

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.22em] text-subtle">LIBRARY</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">片库</h1>
        <p className="mt-2 text-sm text-muted">已索引成片可被检索；未索引素材从 115 接入后进入流水线。</p>
      </header>

      <Section title="可检索" count={ready.length}>
        <Grid videos={ready} />
      </Section>
      {pending.length > 0 && (
        <Section title="待索引" count={pending.length}>
          <Grid videos={pending} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="font-mono text-xs text-subtle tabular">{count}</span>
      </div>
      {children}
    </section>
  );
}

function Grid({ videos }: { videos: Awaited<ReturnType<typeof listVideos>> }) {
  if (videos.length === 0) {
    return <p className="text-sm text-muted">暂无。</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => (
        <li key={v.id}>
          <Link
            to="/library/$id"
            params={{ id: v.id }}
            className="group block overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-line"
          >
            <div className="relative aspect-video overflow-hidden bg-elevated">
              <img src={v.poster} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <span className="absolute bottom-2 right-2 rounded-sm bg-bg/80 px-1.5 py-0.5 font-mono text-[11px] tabular">
                {formatClock(v.duration)}
              </span>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium">{v.title}</h3>
                <Badge tone={v.status === "ready" ? "ok" : v.status === "indexing" ? "warn" : "muted"}>
                  {v.status === "ready" ? "已索引" : v.status === "indexing" ? "索引中" : "待接入"}
                </Badge>
              </div>
              <p className="truncate font-mono text-[11px] text-subtle">{v.filename}</p>
              <p className="text-[11px] text-muted">
                {v.frameCount} 帧 · {v.vectorCount} 向量 · {formatBytes(v.sizeMb)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
