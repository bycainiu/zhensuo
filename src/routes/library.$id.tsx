import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getVideo } from "@/lib/server/fns";
import { Badge } from "@/components/ui/badge";
import { formatClock } from "@/lib/utils";
import type { ViewType } from "@/lib/types";

import { getStored115Cookie } from "@/lib/pan115/client";

type Search = { t?: number };

export const Route = createFileRoute("/library/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    t: typeof s.t === "number" ? s.t : typeof s.t === "string" ? Number(s.t) : undefined,
  }),
  component: VideoDetail,
});

const VIEW_LABEL: Record<ViewType, string> = {
  global: "Global",
  person_context: "Context",
  person_tight: "Tight",
  face: "Face",
};

function VideoDetail() {
  const { id } = Route.useParams();
  const { t } = Route.useSearch();
  const q = useQuery({
    queryKey: ["video", id, getStored115Cookie()],
    queryFn: () => getVideo({ data: { id, cookie: getStored115Cookie() } }),
    staleTime: 0,
  });
  const data = q.data;
  if (q.isLoading) return <p className="text-sm text-muted">读取成片…</p>;
  if (!data) return <p className="text-sm text-muted">未找到该成片。</p>;

  const { video, frames, regions, description } = data;
  const focus = frames.find((f) => t != null && Math.abs(f.timestamp - t) < 1.2) ?? frames[0];

  return (
    <div className="space-y-8">
      <Link to="/library" className="text-xs text-muted hover:text-fg">
        ← 片库
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">{video.title}</h1>
          <Badge tone={video.status === "ready" ? "ok" : "warn"}>
            {video.status === "ready" ? "可检索" : video.status}
          </Badge>
        </div>
        <p className="text-sm text-muted">{description}</p>
        <p className="font-mono text-[11px] text-subtle">{video.path}</p>
      </header>

      {focus && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="relative aspect-video bg-elevated">
            <img
              src={focus.still}
              alt=""
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="h-full w-full object-cover"
            />
            {regions
              .filter((r) => r.frameId === focus.id && r.viewType === "person_tight" && r.bbox)
              .map((r) => (
                <span
                  key={r.id}
                  className="absolute border border-accent/80"
                  style={{
                    left: `${r.bbox!.x * 100}%`,
                    top: `${r.bbox!.y * 100}%`,
                    width: `${r.bbox!.w * 100}%`,
                    height: `${r.bbox!.h * 100}%`,
                  }}
                />
              ))}
            <span className="absolute bottom-3 left-3 rounded-sm bg-bg/80 px-2 py-1 font-mono text-xs tabular">
              {formatClock(focus.timestamp)}
            </span>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-4">
            {(["global", "person_context", "person_tight", "face"] as ViewType[]).map((view) => {
              const n = regions.filter((r) => r.frameId === focus.id && r.viewType === view).length;
              return (
                <div key={view} className="bg-surface px-4 py-3">
                  <p className="font-mono text-[10px] tracking-wider text-subtle">{VIEW_LABEL[view]}</p>
                  <p className="mt-1 text-sm">{n > 0 ? `${n} 向量` : "未建"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium">采样时间线</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {frames.map((f) => (
            <li key={f.id}>
              <Link
                to="/library/$id"
                params={{ id: video.id }}
                search={{ t: f.timestamp }}
                className="block overflow-hidden rounded-lg border border-border bg-surface hover:border-line"
              >
                <div className="aspect-video overflow-hidden bg-elevated">
                  <img
                    src={f.still}
                    alt=""
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-mono tabular">{formatClock(f.timestamp)}</span>
                  <span className="text-muted">{f.persons} 人 · {f.scene.join(" ")}</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
