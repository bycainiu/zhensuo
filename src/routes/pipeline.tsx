import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Cpu,
  Eye,
  Film,
  Layers,
  Loader2,
  Scissors,
  Sparkles,
  Zap,
} from "lucide-react";
import { listJobs, tickJobs } from "@/lib/server/fns";
import { Badge } from "@/components/ui/badge";
import type { JobStage } from "@/lib/types";

export const Route = createFileRoute("/pipeline")({ component: PipelinePage });

const STAGES: { id: JobStage; label: string; detail: string; icon: typeof Activity }[] = [
  { id: "decode", label: "01 解码", detail: "FFmpeg 读 115 视频流", icon: Film },
  { id: "shot", label: "02 镜头", detail: "PySceneDetect 镜头切分", icon: Scissors },
  { id: "sample", label: "03 抽帧", detail: "自适应 1-2 FPS 关键帧采样", icon: Activity },
  { id: "detect", label: "04 检测", detail: "Person / Face 80px+ 三级 Crop", icon: Layers },
  { id: "embed", label: "05 嵌入", detail: "Qwen3-VL 四视图 2048-d", icon: Cpu },
  { id: "index", label: "06 入库", detail: "Qdrant 向量索引 + PG 元数据", icon: Zap },
  { id: "done", label: "07 完成", detail: "中文自然语言精准秒级召回", icon: CheckCircle2 },
];

function PipelinePage() {
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => tickJobs(),
    refetchInterval: 800,
    placeholderData: (prev) => prev,
  });
  const initial = useQuery({ queryKey: ["jobs-init"], queryFn: () => listJobs() });
  const list = jobs.data ?? initial.data ?? [];

  return (
    <div className="space-y-10">
      {/* 头部 */}
      <header>
        <p className="font-mono text-[11px] tracking-[0.22em] text-accent">INGEST & INDEXING PIPELINE</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">AI 视频抽帧索引流水线</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          从 115 网盘点选视频后，不直接全帧送入模型，而是经过镜头切分、关键帧采样、目标与人脸检测，生成 Global / Person Context / Person Tight / Face 四条独立特征向量，保证细粒度属性精准检索。
        </p>
      </header>

      {/* 流水线阶段全览 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">处理工序链路</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {STAGES.map((s) => {
            const Icon = s.icon;
            return (
              <li
                key={s.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-soft"
              >
                <div>
                  <Icon className="h-4 w-4 text-accent" />
                  <p className="mt-2 text-xs font-semibold text-fg">{s.label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{s.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 活跃与历史流水线任务列表 */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-medium">流水线任务监视器</h2>
            <p className="text-xs text-muted">实时显示从 115 网盘导入的视频处理进度与特征抽取日志</p>
          </div>
          <Badge tone="accent">{list.length} 个任务记录</Badge>
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border border-border bg-elevated/30 px-4 py-12 text-center text-sm text-muted">
            <p>当前暂无运行中的流水线任务。</p>
            <p className="mt-2 text-xs text-subtle">
              可前往{" "}
              <Link to="/sources" className="text-accent underline hover:underline">
                「115 接入」
              </Link>{" "}
              选择待接入的视频素材，点击「加入 AI 索引」启动任务。
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map((job) => (
              <li
                key={job.id}
                className="space-y-3 rounded-xl border border-border bg-elevated/40 p-5 shadow-xs transition-colors hover:border-line"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-fg">{job.filename}</span>
                    <span className="font-mono text-[10px] text-subtle">ID: {job.id}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone={job.stage === "done" ? "ok" : job.stage === "error" ? "danger" : "warn"}>
                      {job.stage === "done" ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          已完成
                        </>
                      ) : (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          {job.stage}
                        </>
                      )}
                    </Badge>
                    {job.stage === "done" && job.videoId && (
                      <Link
                        to="/library/$id"
                        params={{ id: job.videoId }}
                        className="text-xs text-accent underline-offset-2 hover:underline"
                      >
                        查看片库 →
                      </Link>
                    )}
                  </div>
                </div>

                {/* 进度条 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">
                      阶段: {STAGES.find((s) => s.id === job.stage)?.label ?? job.stage}
                    </span>
                    <span className="font-mono font-medium tabular text-accent">
                      {Math.round(job.progress * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full bg-accent transition-all duration-500"
                      style={{ width: `${Math.round(job.progress * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 日志记录 */}
                {job.log.length > 0 && (
                  <div className="rounded-lg border border-border bg-bg/80 p-3 font-mono text-[11px] text-subtle">
                    <div className="space-y-1">
                      {job.log.slice(-3).map((l, idx) => (
                        <p key={idx} className="flex items-center gap-2 text-muted">
                          <span className="text-accent/80">▸</span>
                          <span>{l.msg}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
