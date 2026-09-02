import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  CloudLightning,
  Cpu,
  FolderSync,
  HardDrive,
  Info,
  Layers,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  activateModel,
  getColabSettings,
  listModels,
  probeColabNode,
} from "@/lib/server/fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUERY_INSTRUCTION } from "@/lib/engine/embed";
import { toast } from "sonner";

export const Route = createFileRoute("/models")({ component: ModelsPage });

function ModelsPage() {
  const qc = useQueryClient();
  const [colabUrl, setColabUrl] = useState("http://100.92.54.15:8000");

  // 初始化从 localStorage 加载保存的 URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("frameseek_colab_url");
      if (saved) {
        setColabUrl(saved);
      }
    }
  }, []);

  const q = useQuery({ queryKey: ["models"], queryFn: () => listModels() });

  // 实时探测 Colab GPU 节点健康状态与真实显卡信息 (每 8 秒自动保持心跳)
  const colabHealth = useQuery({
    queryKey: ["colab-health", colabUrl],
    queryFn: () => probeColabNode({ data: { url: colabUrl } }),
    enabled: Boolean(colabUrl.trim()),
    refetchInterval: 8000,
  });

  const act = useMutation({
    mutationFn: (id: string) => activateModel({ data: { id } }),
    onSuccess: () => {
      toast.success("已热切换当前主检索模型");
      void qc.invalidateQueries({ queryKey: ["models"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const probeMutation = useMutation({
    mutationFn: (url: string) => probeColabNode({ data: { url } }),
    onSuccess: (res) => {
      if (res.ok) {
        if (typeof window !== "undefined") {
          localStorage.setItem("frameseek_colab_url", colabUrl.trim());
        }
        toast.success(`✅ Colab GPU 连接成功！检测到 ${res.gpu} (${res.device})`);
        void qc.invalidateQueries({ queryKey: ["colab-health"] });
        void qc.invalidateQueries({ queryKey: ["overview"] });
      } else {
        toast.error(`❌ 连接失败：${res.error || "未能连通 Colab 实例"}`);
      }
    },
    onError: (err) => {
      toast.error(`连接异常: ${err instanceof Error ? err.message : "网络超时"}`);
    },
  });

  const embed = (q.data ?? []).filter((m) => m.role === "embedding");
  const rerank = (q.data ?? []).filter((m) => m.role === "reranker");

  const isConnected = Boolean(colabHealth.data?.ok);
  const gpuInfo = colabHealth.data?.gpu ?? "Tesla T4";
  const gdriveDir = colabHealth.data?.gdriveDir ?? "/content/drive/MyDrive/FrameSeek";
  const gdriveOk = colabHealth.data?.gdriveConnected ?? true;

  function handleConnect() {
    if (!colabUrl.trim()) {
      toast.error("请输入有效的 Tailscale 内网地址，例如 http://100.92.54.15:8000");
      return;
    }
    probeMutation.mutate(colabUrl.trim());
  }

  return (
    <div className="space-y-10">
      {/* 头部 */}
      <header>
        <p className="font-mono text-[11px] tracking-[0.22em] text-accent">MODEL MATRIX & GPU ENGINE</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">模型管理与云端 GPU 节点</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          通过 Tailscale 私网直连已在{" "}
          <span className="font-medium text-fg">Google Colab (GPU 实例)</span> 运行的 Qwen3-VL 8B 多模态模型，
          并将抽帧特征与 Qdrant 索引持久化关联到{" "}
          <span className="font-medium text-fg">Google Drive</span>。
        </p>
      </header>

      {/* Google Colab GPU 节点与 Google Drive 存储关联卡片 (持久化与实时检测) */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <CloudLightning className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-sm font-medium">Google Colab GPU 云端推理与 Google Drive 存储关联</h2>
              <p className="text-xs text-muted">Tailscale 私网内网直连 · 零本地显存消耗 · 实时动态状态监控</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {colabHealth.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle" />}
            <Badge tone={isConnected ? "ok" : "warn"}>
              {isConnected ? `🟢 云端 GPU 在线 (${gpuInfo})` : "⚪ 离线或等待连接"}
            </Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          {/* 左侧：Colab 接口连接与持久化 */}
          <div className="space-y-3 rounded-xl border border-border bg-elevated/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fg">Colab Tailscale 私网 Endpoint</span>
              <span className="font-mono text-[10px] text-accent">Tailscale Mesh Direct</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="例如: http://100.92.54.15:8000"
                value={colabUrl}
                onChange={(e) => setColabUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="primary"
                onClick={handleConnect}
                disabled={probeMutation.isPending}
              >
                {probeMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                连接
              </Button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-subtle">
              <span>状态凭证已持久化在本地</span>
              {isConnected && (
                <span className="font-mono text-emerald-400">⚡ 显卡: {gpuInfo} (CUDA 就绪)</span>
              )}
            </div>
          </div>

          {/* 右侧：Google Drive 存储关联 */}
          <div className="space-y-3 rounded-xl border border-border bg-elevated/40 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <HardDrive className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium text-fg">Google Drive 存储同步路径</span>
              </div>
              <Badge tone={gdriveOk ? "ok" : "warn"}>
                {gdriveOk ? "已挂载同步" : "未挂载"}
              </Badge>
            </div>
            <div className="rounded-lg border border-border bg-bg/80 p-2.5 font-mono text-xs text-muted">
              {gdriveDir}
            </div>
            <p className="text-[11px] text-subtle">
              关键帧采样图片、Qdrant 向量索引持久化快照与 FCPXML/EDL 工程均保存在该路径。
            </p>
          </div>
        </div>
      </section>

      {/* 固定英文 Prompt Instruction 卡片 */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-medium">全局统一图文检索 Prompt Instruction (固定英文防漂移)</h2>
        </div>
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted">{QUERY_INSTRUCTION}</p>
        <p className="mt-3 text-xs text-subtle">
          💡 设计考量：用户 Query 保持地道中文；文本 Encoder 侧固定注入统一英文 Instruction，引导模型注意力精准对齐目标动作、衣着与面部微表情。
        </p>
      </div>

      {/* 模型能力横向对比表 */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-medium">图文多模态模型能力对比矩阵</h2>
            <p className="text-xs text-muted">各模型在视频抽帧细粒度检索任务上的实测表现</p>
          </div>
          <Badge tone="accent">Qwen3-VL 综合推荐</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border font-mono text-subtle">
                <th className="py-2.5 pl-2 font-medium">模型架构</th>
                <th className="py-2.5 font-medium">厂商</th>
                <th className="py-2.5 font-medium">维度 (MRL)</th>
                <th className="py-2.5 font-medium">中文能力</th>
                <th className="py-2.5 font-medium">动作识别</th>
                <th className="py-2.5 font-medium">面部神态</th>
                <th className="py-2.5 font-medium">衣着配饰</th>
                <th className="py-2.5 font-medium">复合空间</th>
                <th className="py-2.5 pr-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {embed.map((m) => (
                <tr key={m.id} className={m.active ? "bg-accent/5 font-medium" : "hover:bg-elevated/40"}>
                  <td className="py-3 pl-2 text-fg">{m.name}</td>
                  <td className="py-3 text-muted">{m.vendor}</td>
                  <td className="py-3 font-mono text-muted">{m.dim ? `${m.dim}-d` : "—"}</td>
                  <td className="py-3">
                    <span className="rounded-xs bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">
                      {m.chinese === "strong" ? "原生极强" : "多语言支持"}
                    </span>
                  </td>
                  <td className="py-3 font-mono tabular">{Math.round(m.action * 100)}%</td>
                  <td className="py-3 font-mono tabular">{Math.round(m.expression * 100)}%</td>
                  <td className="py-3 font-mono tabular">{Math.round(m.clothing * 100)}%</td>
                  <td className="py-3 font-mono tabular">{Math.round(m.compound * 100)}%</td>
                  <td className="py-3 pr-2">
                    {m.active ? (
                      <Badge tone="ok">主运行中</Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => act.mutate(m.id)}
                        disabled={act.isPending}
                        className="text-xs text-accent underline-offset-2 hover:underline"
                      >
                        切换
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Embedding 嵌入模型卡片组 */}
      <Group title="多模态特征嵌入模型 (Embedding Models)">
        {embed.map((m) => (
          <article
            key={m.id}
            className={`rounded-2xl border p-5 transition-colors ${
              m.active ? "border-accent bg-accent/5 shadow-soft" : "border-border bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-fg">{m.name}</h3>
                  {m.active && <Badge tone="ok">当前主检索模型</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {m.vendor} · {m.dim ?? "—"} 维 (Matryoshka MRL) · 显存占用 ~{m.vramGb} GB · 适用多视图检索
                </p>
              </div>
              {!m.active && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => act.mutate(m.id)}
                  disabled={act.isPending}
                >
                  设为当前主模型
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">{m.notes}</p>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
              <Meter label="动作 (Action)" value={m.action} />
              <Meter label="神态 (Expression)" value={m.expression} />
              <Meter label="衣着 (Clothing)" value={m.clothing} />
              <Meter label="复合 (Compound)" value={m.compound} />
            </dl>
          </article>
        ))}
      </Group>

      {/* Reranker 重排模型卡片组 */}
      <Group title="跨模态精排与复合推理模型 (Reranker Models)">
        {rerank.map((m) => (
          <article
            key={m.id}
            className={`rounded-2xl border p-5 transition-colors ${
              m.active ? "border-accent bg-accent/5 shadow-soft" : "border-border bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-fg">{m.name}</h3>
                  {m.active && <Badge tone="ok">当前精排模型</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {m.vendor} · Cross-Encoder 深度交互 · 显存占用 ~{m.vramGb} GB
                </p>
              </div>
              {!m.active && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => act.mutate(m.id)}
                  disabled={act.isPending}
                >
                  设为当前精排模型
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">{m.notes}</p>
          </article>
        ))}
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-elevated/40 p-2">
      <p className="text-[10px] text-subtle">{label}</p>
      <div className="mx-auto mt-1.5 h-1.5 w-full max-w-20 overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[10px] tabular text-muted">{Math.round(value * 100)}%</p>
    </div>
  );
}
