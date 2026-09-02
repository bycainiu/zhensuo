import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Clock,
  Download,
  Eye,
  FileCode,
  Layers,
  Loader2,
  Maximize2,
  Play,
  Search,
  Sliders,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exportSearchResults, getOverview, recentSearches, runSearch } from "@/lib/server/fns";
import { formatClock, pan115MediaSrc } from "@/lib/utils";
import type { ExportFormat, SearchHit, SearchTrace, ViewType } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: SearchPage });

const EXAMPLES = [
  "穿黑色夹克戴眼镜、面带微笑、正在打电话的男人",
  "雨夜街道上奔跑的女人",
  "室内球场上红球衣球员扣篮",
  "穿厨师服在后厨烹饪的人",
  "穿白大褂戴听诊器的医生在走廊",
  "穿安全背心戴安全帽开叉车的工人",
  "阳光广场穿红色连衣裙的女性",
  "演播室里西装革履的主持人",
];

const VIEW_LABEL: Record<ViewType, string> = {
  global: "全局场景",
  person_context: "动作上下文",
  person_tight: "目标衣着",
  face: "神态面部",
};

function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [trace, setTrace] = useState<SearchTrace | null>(null);
  const [previewHit, setPreviewHit] = useState<SearchHit | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const overview = useQuery({ queryKey: ["overview"], queryFn: () => getOverview() });
  const recent = useQuery({ queryKey: ["recent"], queryFn: () => recentSearches() });

  const search = useMutation({
    mutationFn: (query: string) => runSearch({ data: { query } }),
    onSuccess: (res) => {
      setHits(res.hits);
      setTrace(res.trace);
      if (res.hits.length === 0) {
        toast("未召回足够匹配的帧，可前往「115 接入」将对应视频加入索引");
      }
    },
    onError: () => toast.error("检索暂时失败，请重试"),
  });

  const exportMut = useMutation({
    mutationFn: (format: ExportFormat) => {
      if (!hits) throw new Error("无检索结果");
      return exportSearchResults({ data: { hits, format } });
    },
    onSuccess: (res) => {
      // 触发浏览器下载
      const blob = new Blob([res.content], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${res.filename}`);
      setExportModalOpen(false);
    },
  });

  function submit(text = q) {
    const next = text.trim();
    if (!next) return;
    setQ(next);
    search.mutate(next);
  }

  const stats = overview.data;

  return (
    <div className="space-y-8">
      {/* 头部标题与描述 */}
      <header className="space-y-3">
        <p className="font-mono text-[11px] tracking-[0.22em] text-accent">
          MULTI-VIEW AI FRAME RETRIEVAL
        </p>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">帧锁 · 用一句话定位镜头</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          面向影视与工业视频的中文多模态多视图帧检索系统。通过全局场景、动作姿态、衣着配饰、神态面部四维特征空间，实现精准片段召回与连续时间戳聚合。
        </p>
      </header>

      {/* 核心指标统计 */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="已索引成片" value={String(stats.ready)} sub="115 网盘素材" />
          <Stat label="采样关键帧" value={String(stats.frames)} sub="自适应 1-2 FPS" />
          <Stat label="四视图向量" value={String(stats.vectors)} sub="2048-d MRL" />
          <Stat label="当前主模型" value="8B" sub={stats.activeEmbed} />
        </div>
      )}

      {/* 搜索框 */}
      <form
        className="rounded-2xl border border-border bg-surface p-3 shadow-soft md:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="sr-only">自然语言检索语句</span>
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              rows={2}
              placeholder="输入中文自然语言描述，例如：穿黑色夹克戴眼镜、面带微笑正在打电话的男人"
              className="w-full resize-none bg-transparent px-3 py-2 text-base text-fg outline-none placeholder:text-subtle"
            />
          </label>
          <Button
            type="submit"
            size="lg"
            variant="primary"
            disabled={search.isPending}
            className="mb-1 shrink-0 px-6 font-medium shadow-md"
          >
            {search.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            检索镜头
          </Button>
        </div>
      </form>

      {/* 快速示例 Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-subtle">推荐检索：</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => submit(ex)}
            className="rounded-full border border-border bg-elevated px-3 py-1 text-xs text-muted transition-colors hover:border-line hover:text-fg"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* 查询分解与多视图权重 (Search Trace) */}
      {trace && (
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-medium">中文查询语义分解与权重配比</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={trace.query.source === "grok" ? "ok" : "accent"}>
                {trace.query.source === "grok" ? "xAI Grok-4.5 语义分解" : "词表细粒度解析"}
              </Badge>
              <Badge>{trace.modelId}</Badge>
              <Badge>{trace.dim}-d MRL</Badge>
              <Badge>{trace.latencyMs} ms</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Facet label="主体" items={trace.query.subject ? [trace.query.subject] : []} />
            <Facet label="动作" items={trace.query.action} />
            <Facet label="衣着" items={trace.query.clothing} />
            <Facet label="配饰" items={trace.query.accessories} />
            <Facet label="神态" items={trace.query.expression} />
            <Facet label="场景" items={trace.query.scene} />
            <Facet label="物体" items={trace.query.objects} />
            <Facet label="角色" items={trace.query.role} />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(Object.keys(trace.weights) as ViewType[]).map((k) => (
              <div key={k} className="space-y-1.5 rounded-lg border border-border bg-elevated/40 p-2.5">
                <div className="flex justify-between text-[11px] text-muted">
                  <span>{VIEW_LABEL[k]}</span>
                  <span className="font-mono tabular text-fg">
                    {Math.round(trace.weights[k] * 100)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full bg-accent transition-all duration-500"
                    style={{ width: `${trace.weights[k] * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 命中片段结果列表 */}
      {hits && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">命中镜头片段</h2>
              <p className="text-xs text-subtle">
                共召回 {hits.length} 个镜头片段 · 已自动聚合连续时间戳
              </p>
            </div>

            {hits.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setExportModalOpen(true)}
                className="text-xs"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                导出剪辑工程 (FCPXML / EDL)
              </Button>
            )}
          </div>

          {hits.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center text-sm text-muted">
              <p>没有命中匹配的已索引素材。</p>
              <p className="mt-2 text-xs text-subtle">
                提示：医生、羽绒服、叉车等素材已在 115 目录中，前往{" "}
                <Link to="/sources" className="text-accent underline hover:underline">
                  「115 接入」
                </Link>{" "}
                点击「加入 AI 索引」后即可直接搜索。
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {hits.map((hit) => (
                <li key={`${hit.videoId}-${hit.frameId}`}>
                  <HitCard hit={hit} onPreview={() => setPreviewHit(hit)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 最近检索记录 */}
      {!hits && recent.data && recent.data.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Clock className="h-3.5 w-3.5" />
            <span>最近检索历史</span>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {recent.data.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-elevated"
                  onClick={() => submit(s.query)}
                >
                  <span className="truncate text-fg">{s.query}</span>
                  <span className="shrink-0 font-mono text-[11px] text-subtle">
                    {s.result_count} 命中 · {s.latency_ms}ms
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 快速播放与帧预览弹窗 */}
      {previewHit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="text-base font-medium">{previewHit.title}</h3>
                <p className="font-mono text-xs text-subtle">
                  时间轴区间：{formatClock(previewHit.start)} – {formatClock(previewHit.end)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewHit(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-fg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
                <img src={pan115MediaSrc(previewHit.still)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                {previewHit.bbox && (
                  <span
                    className="absolute border-2 border-accent shadow-md transition-all"
                    style={{
                      left: `${previewHit.bbox.x * 100}%`,
                      top: `${previewHit.bbox.y * 100}%`,
                      width: `${previewHit.bbox.w * 100}%`,
                      height: `${previewHit.bbox.h * 100}%`,
                    }}
                  >
                    <span className="absolute -top-6 left-0 rounded-xs bg-accent px-1.5 py-0.5 font-mono text-[10px] text-accent-fg">
                      匹配主体
                    </span>
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {previewHit.evidence.map((ev) => (
                  <div key={ev.view} className="rounded-lg border border-border bg-elevated p-3">
                    <p className="font-mono text-[10px] text-subtle">{VIEW_LABEL[ev.view]}</p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular">
                      Rank #{ev.rank} · {Math.round(ev.score * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-border p-4">
              <Button variant="secondary" onClick={() => setPreviewHit(null)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 导出剪辑工程弹窗 */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-medium">导出检索命中的镜头片段</h3>
            <p className="mt-1 text-xs text-muted">
              直接导入专业后期非编剪辑软件或下游数据处理。
            </p>

            <div className="mt-4 grid gap-2.5">
              {[
                { format: "fcpxml" as const, name: "Final Cut Pro (FCPXML)", desc: "导入 Apple Final Cut Pro 剪辑时间线" },
                { format: "edl" as const, name: "Premiere / DaVinci (EDL)", desc: "标准 CMX 3600 EDL 剪辑决策列表" },
                { format: "json" as const, name: "结构化 JSON 片段集", desc: "包含精准时间戳与 BBox 坐标" },
                { format: "csv" as const, name: "CSV 表格文件", desc: "包含镜头片名、时间点与置信度" },
              ].map((fmt) => (
                <button
                  key={fmt.format}
                  type="button"
                  onClick={() => exportMut.mutate(fmt.format)}
                  disabled={exportMut.isPending}
                  className="flex items-center justify-between rounded-xl border border-border bg-elevated/50 p-3.5 text-left transition-colors hover:border-accent hover:bg-elevated"
                >
                  <div>
                    <p className="text-xs font-medium">{fmt.name}</p>
                    <p className="text-[11px] text-subtle">{fmt.desc}</p>
                  </div>
                  <Download className="h-4 w-4 text-muted" />
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setExportModalOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5 shadow-soft">
      <p className="text-[11px] text-subtle">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular leading-none">{value}</p>
      {sub && <p className="mt-1.5 truncate text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function Facet({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-subtle">{label}:</span>
      {items.map((it) => (
        <Badge key={it} tone="accent">
          {it}
        </Badge>
      ))}
    </div>
  );
}

function HitCard({ hit, onPreview }: { hit: SearchHit; onPreview: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-line">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)]">
        {/* 左侧：画面与 BBox */}
        <div className="relative aspect-video overflow-hidden bg-black">
          <img src={pan115MediaSrc(hit.still)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          {hit.bbox && (
            <span
              className="absolute border border-accent/90"
              style={{
                left: `${hit.bbox.x * 100}%`,
                top: `${hit.bbox.y * 100}%`,
                width: `${hit.bbox.w * 100}%`,
                height: `${hit.bbox.h * 100}%`,
              }}
            />
          )}
          <span className="absolute bottom-2 left-2 rounded-md bg-bg/85 px-2 py-0.5 font-mono text-[11px] tabular text-fg backdrop-blur-xs">
            {formatClock(hit.start)} – {formatClock(hit.end)}
          </span>
          <button
            type="button"
            onClick={onPreview}
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-bg/85 px-2 py-1 text-xs text-fg backdrop-blur-xs hover:bg-accent hover:text-accent-fg"
          >
            <Maximize2 className="h-3 w-3" />
            放大预览
          </button>
        </div>

        {/* 右侧：得分与命中属性 */}
        <div className="flex flex-col justify-between gap-3 p-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Link
                to="/library/$id"
                params={{ id: hit.videoId }}
                search={{ t: hit.timestamp }}
                className="text-base font-medium text-fg hover:text-accent"
              >
                {hit.title}
              </Link>
              <div className="text-right">
                <span className="font-display text-2xl font-bold tabular text-accent">
                  {Math.round(hit.score * 100)}%
                </span>
                <p className="text-[10px] text-subtle">综合置信度</p>
              </div>
            </div>

            {/* 命中词 vs 未命中词 */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {hit.matched.map((m) => (
                <Badge key={m} tone="ok">
                  ✓ {m}
                </Badge>
              ))}
              {hit.missing.map((m) => (
                <Badge key={m} tone="muted">
                  - {m}
                </Badge>
              ))}
            </div>
          </div>

          {/* 四视图得分条 */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {hit.evidence.map((ev) => (
                <div key={ev.view} className="flex items-center justify-between text-subtle">
                  <span>{VIEW_LABEL[ev.view]}:</span>
                  <span className="font-mono tabular text-muted">
                    Rank #{ev.rank} ({Math.round(ev.score * 100)}%)
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Link
                to="/library/$id"
                params={{ id: hit.videoId }}
                search={{ t: hit.timestamp }}
                className="inline-flex items-center gap-1 text-xs text-accent underline-offset-2 hover:underline"
              >
                查看完整关键帧时间线 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
