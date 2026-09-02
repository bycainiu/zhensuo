import { useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVideo, triggerColabFrameExtract, updateFrameStill } from "@/lib/server/fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/utils";
import type { ViewType } from "@/lib/types";
import { getStored115Cookie } from "@/lib/pan115/client";
import { toast } from "sonner";
import { Sparkles, Upload, RefreshCw } from "lucide-react";

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
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ["video", id, getStored115Cookie()],
    queryFn: () => getVideo({ data: { id, cookie: getStored115Cookie() } }),
    staleTime: 0,
  });

  const extractMut = useMutation({
    mutationFn: () => triggerColabFrameExtract({ data: { videoId: id, cookie: getStored115Cookie() } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`GPU 抽帧完成！已更新 ${res.framesUpdated ?? 0} 个真实画面`);
        void qc.invalidateQueries({ queryKey: ["video", id] });
        void qc.invalidateQueries({ queryKey: ["videos"] });
      } else {
        toast.error(res.error || "抽帧未完成，请检查 Colab / 115 连通状态");
      }
    },
  });

  const uploadStillMut = useMutation({
    mutationFn: (args: { frameId: string; videoId: string; stillUrl: string }) =>
      updateFrameStill({ data: args }),
    onSuccess: () => {
      toast.success("画面帧已成功更新为真实图片！");
      void qc.invalidateQueries({ queryKey: ["video", id] });
      void qc.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  const data = q.data;
  if (q.isLoading) return <p className="text-sm text-muted">读取成片…</p>;
  if (!data) return <p className="text-sm text-muted">未找到该成片。</p>;

  const { video, frames, regions, description } = data;
  const focus = frames.find((f) => t != null && Math.abs(f.timestamp - t) < 1.2) ?? frames[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !focus) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        uploadStillMut.mutate({
          frameId: focus.id,
          videoId: video.id,
          stillUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      <Link to="/library" className="text-xs text-muted hover:text-fg">
        ← 片库
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl tracking-tight md:text-4xl">{video.title}</h1>
            <Badge tone={video.status === "ready" ? "ok" : "warn"}>
              {video.status === "ready" ? "可检索" : video.status}
            </Badge>
          </div>
          <p className="text-sm text-muted">{description}</p>
          <p className="font-mono text-[11px] text-subtle">{video.path}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={extractMut.isPending}
            onClick={() => extractMut.mutate()}
            className="border-accent/40 hover:bg-accent/10"
          >
            {extractMut.isPending ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-accent" />
            )}
            {extractMut.isPending ? "GPU 抽取中…" : "Colab GPU 抽取原片帧"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            className="border border-border"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            替换当前帧图片
          </Button>
        </div>
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
