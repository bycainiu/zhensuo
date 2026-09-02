import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Code,
  Copy,
  Cpu,
  Database,
  Download,
  Film,
  Globe,
  HardDrive,
  Layers,
  Loader2,
  Play,
  Radio,
  Search,
  Send,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { executeApiPlayground, listApps, toggleApp } from "@/lib/server/fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ApiPlaygroundRequest, ApiPlaygroundResponse } from "@/lib/types";

export const Route = createFileRoute("/workflow")({ component: WorkflowPage });

const NODES = [
  {
    id: "up",
    num: "01",
    title: "115 上游素材源",
    icon: HardDrive,
    lines: ["115 苹果设备扫码", "115 Cookie 直连", "演示沙箱与本地导入"],
  },
  {
    id: "pipe",
    num: "02",
    title: "解码与镜头切分",
    icon: Film,
    lines: ["FFmpeg 容器解析", "PySceneDetect 镜头切分", "自适应抽帧 (1-2 FPS)"],
  },
  {
    id: "detect",
    num: "03",
    title: "目标与人脸检测",
    icon: Layers,
    lines: ["YOLO 目标定位", "Face 80px+ 特写裁切", "Global/Tight/Context 视图生成"],
  },
  {
    id: "emb",
    num: "04",
    title: "核心多模态向量服务",
    icon: Cpu,
    lines: ["Qwen3-VL-Embedding-8B", "多视图 MRL 2048-d", "动态热切换模型"],
  },
  {
    id: "q",
    num: "05",
    title: "在线检索与精排",
    icon: Search,
    lines: ["中文查询语义分解", "四视图自适应 RRF 融合", "Qwen3-VL-Reranker-8B"],
  },
  {
    id: "down",
    num: "06",
    title: "下游应用与生态",
    icon: Zap,
    lines: ["Final Cut Pro FCPXML", "Premiere EDL 时间线", "Video RAG / Webhook"],
  },
];

const API_ENDPOINTS = [
  {
    method: "POST" as const,
    path: "/api/v1/core/search",
    title: "核心检索接口",
    desc: "输入中文自然语言描述，返回多视图融合与精排后的视频片段与时间区间",
    defaultBody: JSON.stringify(
      {
        query: "穿黑色夹克戴眼镜、面带微笑正在打电话的男人",
        topK: 5,
        rerank: true,
      },
      null,
      2,
    ),
  },
  {
    method: "POST" as const,
    path: "/api/v1/core/embed/text",
    title: "文本向量嵌入接口",
    desc: "将中文查询通过固定 Instruction 嵌入到 2048 维向量空间",
    defaultBody: JSON.stringify(
      {
        text: "雨夜街道上奔跑的女人",
        dim: 2048,
      },
      null,
      2,
    ),
  },
  {
    method: "GET" as const,
    path: "/api/v1/upstream/browse",
    title: "上游素材浏览接口",
    desc: "列出当前已连接 115 网盘目录与可用视频素材",
    defaultBody: JSON.stringify({ cid: "0" }, null, 2),
  },
  {
    method: "POST" as const,
    path: "/api/v1/downstream/export",
    title: "下游剪辑工程导出",
    desc: "将检索命中的视频片段导出为 Final Cut Pro (FCPXML) 或 Premiere (EDL) 工程",
    defaultBody: JSON.stringify({ format: "fcpxml" }, null, 2),
  },
];

function WorkflowPage() {
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ["apps"], queryFn: () => listApps() });
  const tog = useMutation({
    mutationFn: (p: { id: string; enabled: boolean }) => toggleApp({ data: p }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["apps"] }),
  });

  // API Playground 状态
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState(0);
  const [requestBody, setRequestBody] = useState(API_ENDPOINTS[0]!.defaultBody);
  const [playgroundResponse, setPlaygroundResponse] = useState<ApiPlaygroundResponse | null>(null);

  const selectedEndpoint = API_ENDPOINTS[selectedEndpointIndex]!;

  const runPlayground = useMutation<ApiPlaygroundResponse, Error, ApiPlaygroundRequest>({
    mutationFn: async (req: ApiPlaygroundRequest) => {
      const res = await executeApiPlayground({ data: req });
      return res as ApiPlaygroundResponse;
    },
    onSuccess: (res) => {
      setPlaygroundResponse(res);
      toast.success(`请求完成 · HTTP ${res.status} (${res.latencyMs}ms)`);
    },
    onError: () => toast.error("请求失败，请检查参数"),
  });

  function selectEndpoint(idx: number) {
    setSelectedEndpointIndex(idx);
    setRequestBody(API_ENDPOINTS[idx]!.defaultBody);
    setPlaygroundResponse(null);
  }

  function handleSend() {
    runPlayground.mutate({
      method: selectedEndpoint.method,
      path: selectedEndpoint.path,
      body: requestBody,
    });
  }

  function copyCurl() {
    const curl = `curl -X ${selectedEndpoint.method} https://api.frameseek.ai${selectedEndpoint.path} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer fs_live_key_9921" \\
  -d '${requestBody.replace(/\n/g, "")}'`;
    void navigator.clipboard.writeText(curl);
    toast.success("已复制 cURL 请求命令");
  }

  return (
    <div className="space-y-10">
      {/* 头部标题 */}
      <header>
        <p className="font-mono text-[11px] tracking-[0.22em] text-accent">SYSTEM ARCHITECTURE</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">AI 视频工作流全景</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          解耦上游素材输入、核心多模态图文嵌入服务与下游场景应用。上游接入 115 网盘，核心模型支持即时热替换，下游无缝对接剪辑非编软件与 Agent 知识库。
        </p>
      </header>

      {/* 工作流六大节点全景图 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-medium">全链路节点图谱</h2>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {NODES.map((n) => {
            const Icon = n.icon;
            return (
              <li
                key={n.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-all hover:border-accent hover:shadow-soft"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-accent">{n.num}</span>
                    <Icon className="h-4 w-4 text-subtle transition-colors group-hover:text-accent" />
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-fg">{n.title}</h3>
                  <ul className="mt-2.5 space-y-1 text-xs text-muted">
                    {n.lines.map((l) => (
                      <li key={l} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-accent/60" />
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 下游场景集成管理 */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-medium">下游应用生态与集成状态</h2>
            <p className="text-xs text-muted">管理检索命中片段对外部系统的分发与工程导出</p>
          </div>
          <Badge tone="accent">4 个已就绪连接器</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(apps.data ?? []).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-elevated/40 p-4 transition-colors hover:border-line"
            >
              <div>
                <p className="text-sm font-medium text-fg">{a.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-subtle">
                  类型: {a.kind.toUpperCase()} · 状态: {a.enabled ? "正常投递" : "已暂停"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={a.enabled ? "ok" : "muted"}>{a.enabled ? "运行中" : "已停用"}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => tog.mutate({ id: a.id, enabled: !a.enabled })}
                >
                  {a.enabled ? "关闭" : "开启"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 统一 API 规范与在线交互式 Playground */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-sm font-medium">统一 API 规范与交互调试台 (Playground)</h2>
              <p className="text-xs text-muted">直接在线模拟调用上下游与核心引擎 REST API</p>
            </div>
          </div>

          <Button size="sm" variant="ghost" onClick={copyCurl} className="text-xs text-muted hover:text-fg">
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            复制 cURL 命令
          </Button>
        </div>

        {/* 接口选择卡片 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {API_ENDPOINTS.map((ep, i) => {
            const isSelected = i === selectedEndpointIndex;
            return (
              <button
                key={ep.path}
                type="button"
                onClick={() => selectEndpoint(i)}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-accent bg-accent/10 shadow-xs"
                    : "border-border bg-elevated/40 hover:border-line hover:bg-elevated"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-xs px-1 py-0.2 font-mono text-[9px] font-bold ${
                      ep.method === "POST" ? "bg-accent/20 text-accent" : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="truncate text-xs font-medium text-fg">{ep.title}</span>
                </div>
                <span className="mt-1 truncate font-mono text-[10px] text-subtle">{ep.path}</span>
              </button>
            );
          })}
        </div>

        {/* 请求与响应区域 */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 左侧：请求体配置 */}
          <div className="space-y-3 rounded-xl border border-border bg-elevated/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-accent" />
                <span className="font-mono text-xs text-fg">Request Payload (JSON)</span>
              </div>
              <span className="text-[10px] text-subtle">{selectedEndpoint.desc}</span>
            </div>

            <textarea
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              rows={9}
              className="w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs text-fg outline-none focus:border-accent"
            />

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSend}
                disabled={runPlayground.isPending}
                className="shadow-sm"
              >
                {runPlayground.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                发送请求 (Send)
              </Button>
            </div>
          </div>

          {/* 右侧：响应结果 */}
          <div className="space-y-3 rounded-xl border border-border bg-elevated/30 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-fg">Response Output</span>
              {playgroundResponse && (
                <div className="flex items-center gap-2">
                  <Badge tone={playgroundResponse.status === 200 ? "ok" : "danger"}>
                    HTTP {playgroundResponse.status} {playgroundResponse.statusText}
                  </Badge>
                  <span className="font-mono text-[10px] text-subtle">{playgroundResponse.latencyMs} ms</span>
                </div>
              )}
            </div>

            <pre className="h-[220px] overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-muted">
              {playgroundResponse
                ? JSON.stringify(playgroundResponse.data, null, 2)
                : '// 点击 "发送请求" 执行实时接口调用...'}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
