import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Apple,
  CheckCircle2,
  ChevronRight,
  Folder,
  Globe,
  HardDrive,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Video,
} from "lucide-react";
import {
  browse115,
  check115QrStatus,
  disconnect115Source,
  get115QrSession,
  listSources,
  save115Cookie,
  save115Tokens,
  startIngest,
  trigger115Simulation,
} from "@/lib/server/fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes, formatClock } from "@/lib/utils";
import { toast } from "sonner";
import type { Pan115AppType, Pan115QrSession, PanFile } from "@/lib/types";

export const Route = createFileRoute("/sources")({ component: SourcesPage });

type SourceTab = "qr" | "cookie" | "open" | "sandbox";

function SourcesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<SourceTab>("qr");
  const [appType, setAppType] = useState<Pan115AppType>("ios");

  // 扫码登录状态
  const [qrSession, setQrSession] = useState<Pan115QrSession | null>(null);
  const [qrStatusText, setQrStatusText] = useState("等待扫码中...");
  const [qrStatusCode, setQrStatusCode] = useState<number>(0);
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);

  // Cookie 登录表单
  const [cookieInput, setCookieInput] = useState("");

  // 开放平台表单
  const [openForm, setOpenForm] = useState({
    appId: "",
    appSecret: "",
    accessToken: "",
    refreshToken: "",
    rootCid: "0",
  });

  // 网盘浏览状态
  const [cid, setCid] = useState("0");
  const [searchQuery, setSearchQuery] = useState("");
  const [stack, setStack] = useState<{ cid: string; name: string }[]>([
    { cid: "0", name: "115 云端根目录" },
  ]);

  const sources = useQuery({ queryKey: ["sources"], queryFn: () => listSources() });
  const browse = useQuery({
    queryKey: ["115", cid, searchQuery],
    queryFn: () => browse115({ data: { cid, search: searchQuery } }),
  });

  // 获取活跃的 115 账号
  const activeQrSource = sources.data?.find((s) => s.id === "src_115_qr");
  const activeCookieSource = sources.data?.find((s) => s.id === "src_115_cookie");
  const connectedUser =
    (activeQrSource?.status === "connected" && activeQrSource.user) ||
    (activeCookieSource?.status === "connected" && activeCookieSource.user) ||
    null;

  // 生成/刷新二维码
  async function refreshQr(selectedApp = appType) {
    setIsRefreshingQr(true);
    try {
      const session = await get115QrSession({ data: { app: selectedApp } });
      setQrSession(session);
      setQrStatusCode(0);
      setQrStatusText("二维码已就绪，请使用 115 客户端扫码");
    } catch {
      toast.error("获取 115 二维码失败，请重试");
    } finally {
      setIsRefreshingQr(false);
    }
  }

  // 初始化获取二维码
  useEffect(() => {
    if (activeTab === "qr" && !qrSession) {
      void refreshQr(appType);
    }
  }, [activeTab]);

  // 轮询二维码扫码状态
  useEffect(() => {
    if (activeTab !== "qr" || !qrSession || qrStatusCode === 2 || qrStatusCode === -1) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const res = await check115QrStatus({
          data: {
            uid: qrSession.uid,
            time: qrSession.time,
            sign: qrSession.sign,
            app: appType,
          },
        });
        setQrStatusCode(res.status);
        setQrStatusText(res.msg);

        if (res.status === 2) {
          toast.success("115 扫码登录成功！");
          void qc.invalidateQueries({ queryKey: ["sources"] });
          void qc.invalidateQueries({ queryKey: ["overview"] });
          void qc.invalidateQueries({ queryKey: ["115"] });
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [activeTab, qrSession, qrStatusCode, appType]);

  // 模拟扫码确认（用于测试与沙箱演练）
  const simScan = useMutation({
    mutationFn: (targetStatus: 1 | 2) => {
      if (!qrSession) throw new Error("无有效二维码");
      return trigger115Simulation({ data: { uid: qrSession.uid, status: targetStatus, app: appType } });
    },
    onSuccess: (_, status) => {
      if (status === 1) {
        setQrStatusCode(1);
        setQrStatusText("已扫码，请在苹果设备上点击「确认登录」");
        toast.info("已模拟苹果设备扫码");
      } else {
        setQrStatusCode(2);
        setQrStatusText("登录成功！");
        toast.success("已模拟确认登录！");
        void qc.invalidateQueries({ queryKey: ["sources"] });
        void qc.invalidateQueries({ queryKey: ["overview"] });
        void qc.invalidateQueries({ queryKey: ["115"] });
      }
    },
  });

  // 保存 Cookie 登录
  const saveCookieMut = useMutation({
    mutationFn: (cookie: string) => save115Cookie({ data: { cookie } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.detail || "115 Cookie 连接成功！");
        setCookieInput("");
        void qc.invalidateQueries({ queryKey: ["sources"] });
        void qc.invalidateQueries({ queryKey: ["overview"] });
        void qc.invalidateQueries({ queryKey: ["115"] });
      } else {
        toast.error(res.detail || "Cookie 校验失败");
      }
    },
  });

  // 保存开放平台配置
  const saveOpenMut = useMutation({
    mutationFn: () => save115Tokens({ data: openForm }),
    onSuccess: (res) => {
      toast(res.ok ? "115 开放平台连通" : `未能连通：${res.detail}`);
      void qc.invalidateQueries({ queryKey: ["sources"] });
    },
  });

  // 断开当前 115 账号
  const disconnectMut = useMutation({
    mutationFn: (sourceId: string) => disconnect115Source({ data: { sourceId } }),
    onSuccess: () => {
      toast.success("已断开 115 连接");
      void qc.invalidateQueries({ queryKey: ["sources"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
      void qc.invalidateQueries({ queryKey: ["115"] });
      void refreshQr(appType);
    },
  });

  // 加入抽帧索引流水线
  const ingest = useMutation({
    mutationFn: (videoId: string) => startIngest({ data: { videoId } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("素材已成功加入 AI 抽帧索引流水线");
        void qc.invalidateQueries({ queryKey: ["videos"] });
        void qc.invalidateQueries({ queryKey: ["jobs"] });
        void qc.invalidateQueries({ queryKey: ["115"] });
      } else {
        toast.error(res.error || "加入流水线失败");
      }
    },
  });

  function enter(item: PanFile) {
    if (!item.isDir) return;
    setCid(item.fid);
    setSearchQuery("");
    setStack((s) => [...s, { cid: item.fid, name: item.name }]);
  }

  function jump(index: number) {
    const next = stack.slice(0, index + 1);
    setStack(next);
    setCid(next[next.length - 1]!.cid);
    setSearchQuery("");
  }

  return (
    <div className="space-y-10">
      {/* 顶部标题 */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-accent">UPSTREAM INTEGRATION</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">115 网盘接入</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            将 115 网盘作为 AI 帧检索系统的统一上游素材库。支持{" "}
            <span className="font-medium text-fg">苹果设备（iPhone / iPad / Mac）扫码登录</span>、
            <span className="font-medium text-fg">Cookie 直连</span> 与{" "}
            <span className="font-medium text-fg">开放平台 OAuth</span>。可直接浏览云端素材并一键加入多视图 AI 抽帧索引。
          </p>
        </div>

        {connectedUser && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-soft">
            <img
              src={connectedUser.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full border border-border object-cover"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{connectedUser.userName}</span>
                <Badge tone="ok">{connectedUser.vipLevel || "VIP"}</Badge>
              </div>
              <p className="font-mono text-[10px] text-subtle">
                已用 {formatBytes(connectedUser.spaceUsedGb * 1024)} / {formatBytes(connectedUser.spaceTotalGb * 1024)} · {connectedUser.device}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="ml-2 text-subtle hover:text-danger"
              onClick={() => {
                const sid = activeQrSource?.status === "connected" ? "src_115_qr" : "src_115_cookie";
                disconnectMut.mutate(sid);
              }}
              disabled={disconnectMut.isPending}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </header>

      {/* 登录与凭证面板 */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-accent" />
            <h2 className="font-medium">115 认证与连接方式</h2>
          </div>

          {/* 切换 Tab */}
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-elevated p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("qr")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeTab === "qr" ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg"
              }`}
            >
              <Apple className="h-3.5 w-3.5" />
              苹果设备/Web 扫码
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cookie")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeTab === "cookie" ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Cookie 登录
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("open")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeTab === "open" ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              开放平台 (OAuth)
            </button>
          </div>
        </div>

        <div className="mt-6">
          {/* Tab 1: 苹果设备扫码登录 */}
          {activeTab === "qr" && (
            <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
              {/* 二维码卡片 */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-elevated/50 p-6 text-center">
                <div className="relative aspect-square w-48 overflow-hidden rounded-xl border border-border bg-white p-3 shadow-inner">
                  {qrSession ? (
                    <img
                      src={qrSession.qrcode}
                      alt="115 扫码登录"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted" />
                    </div>
                  )}

                  {/* 扫描成功浮层 */}
                  {qrStatusCode === 2 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-3 text-white">
                      <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                      <p className="mt-2 text-xs font-medium">登录成功</p>
                    </div>
                  )}
                </div>

                {/* 状态徽标与倒计时 */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Badge tone={qrStatusCode === 2 ? "ok" : qrStatusCode === 1 ? "warn" : "accent"}>
                      {qrStatusText}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted hover:text-fg"
                      onClick={() => refreshQr(appType)}
                      disabled={isRefreshingQr}
                    >
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshingQr ? "animate-spin" : ""}`} />
                      刷新二维码
                    </Button>
                  </div>
                </div>
              </div>

              {/* 右侧：苹果设备形态选择与测试动作 */}
              <div className="flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">选择扫码设备客户端形态</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      115 对不同客户端形态下发的 Token 与会话策略略有不同。推荐优先使用{" "}
                      <span className="text-fg font-medium">Apple iOS (iPhone)</span> 或{" "}
                      <span className="text-fg font-medium">iPad</span> 官方客户端扫码。
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { id: "ios" as const, label: "iPhone (iOS)", icon: Smartphone, desc: "115 iOS 官方版" },
                      { id: "ipad" as const, label: "iPad 客户端", icon: Tablet, desc: "115 HD / iPad" },
                      { id: "mac" as const, label: "Mac 客户端", icon: Laptop, desc: "115 Mac 桌面端" },
                      { id: "web" as const, label: "Web 网页端", icon: Globe, desc: "115.com 扫码" },
                    ].map((dev) => {
                      const Icon = dev.icon;
                      const isSelected = appType === dev.id;
                      return (
                        <button
                          key={dev.id}
                          type="button"
                          onClick={() => {
                            setAppType(dev.id);
                            void refreshQr(dev.id);
                          }}
                          className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                            isSelected
                              ? "border-accent bg-accent/10 shadow-xs"
                              : "border-border bg-surface hover:border-line hover:bg-elevated"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon className={`h-4 w-4 ${isSelected ? "text-accent" : "text-muted"}`} />
                            <span className="text-xs font-medium">{dev.label}</span>
                          </div>
                          <span className="mt-1 font-mono text-[10px] text-subtle">{dev.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border border-border bg-elevated/40 p-3 text-xs leading-relaxed text-muted">
                    <p className="font-medium text-fg">📱 苹果设备扫码指引：</p>
                    <ol className="mt-1.5 list-inside list-decimal space-y-1 text-subtle">
                      <li>打开 iPhone / iPad 上的 115 App；</li>
                      <li>点击右上角「+」或「扫一扫」扫描左侧二维码；</li>
                      <li>在设备上点击「确认登录」，系统将自动完成鉴权并同步网盘素材。</li>
                    </ol>
                  </div>
                </div>

                {/* 模拟与辅助功能 */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <span className="text-xs text-subtle">
                    开发与演示环境？支持直接模拟扫码行为：
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => simScan.mutate(1)}
                      disabled={simScan.isPending || !qrSession}
                    >
                      模拟扫码
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => simScan.mutate(2)}
                      disabled={simScan.isPending || !qrSession}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      模拟苹果端确认登录
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Cookie 登录 */}
          {activeTab === "cookie" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">115 Cookie 会话直连</h3>
                <p className="mt-1 text-xs text-muted">
                  从 115.com 网页端或客户端抓包复制完整的 Cookie 字符串（包含 UID, CID, SEID, KID 等核心字段）。
                </p>
              </div>

              <textarea
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                rows={4}
                placeholder="例如：UID=u_18920194; CID=c_9821731; SEID=seid_889210_token; KID=kid_9918..."
                className="w-full rounded-xl border border-border bg-elevated px-4 py-3 font-mono text-xs text-fg outline-none placeholder:text-subtle focus:border-accent"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted hover:text-fg"
                  onClick={() =>
                    setCookieInput(
                      "UID=u_pro_editor_88; CID=c_1756654321; SEID=seid_apple_prod_key; KID=kid_115_vip;",
                    )
                  }
                >
                  填入示例 Cookie
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => saveCookieMut.mutate(cookieInput)}
                  disabled={saveCookieMut.isPending || !cookieInput.trim()}
                >
                  {saveCookieMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  校验并建立连接
                </Button>
              </div>
            </div>
          )}

          {/* Tab 3: 115 开放平台 OAuth 2.0 */}
          {activeTab === "open" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">115 生活开放平台 (open.115.com)</h3>
                <p className="mt-1 text-xs text-muted">
                  官方 OAuth 2.0 授权机制。接口地址：<code>passportapi.115.com/open/authorize</code>。
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="App ID"
                  value={openForm.appId}
                  onChange={(v) => setOpenForm({ ...openForm, appId: v })}
                />
                <Field
                  label="App Secret"
                  type="password"
                  value={openForm.appSecret}
                  onChange={(v) => setOpenForm({ ...openForm, appSecret: v })}
                />
                <Field
                  label="Access Token"
                  value={openForm.accessToken}
                  onChange={(v) => setOpenForm({ ...openForm, accessToken: v })}
                />
                <Field
                  label="Refresh Token"
                  value={openForm.refreshToken}
                  onChange={(v) => setOpenForm({ ...openForm, refreshToken: v })}
                />
                <Field
                  label="根目录 CID"
                  value={openForm.rootCid}
                  onChange={(v) => setOpenForm({ ...openForm, rootCid: v })}
                />
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => saveOpenMut.mutate()}
                disabled={saveOpenMut.isPending}
              >
                {saveOpenMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                探测并保存开放平台配置
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* 115 云端目录与视频素材库 */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            <div>
              <h2 className="font-medium">115 云端视频素材库</h2>
              <p className="text-xs text-muted">浏览网盘目录，选择视频加入 AI 帧特征抽取流水线</p>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-subtle" />
            <input
              type="text"
              placeholder="在网盘中搜索素材..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated py-1.5 pl-8 pr-3 text-xs text-fg outline-none placeholder:text-subtle focus:border-accent"
            />
          </div>
        </div>

        {/* 面包屑导航 */}
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {stack.map((n, i) => (
            <span key={n.cid} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-subtle" />}
              <button
                type="button"
                className={`transition-colors hover:text-fg ${i === stack.length - 1 ? "font-medium text-fg" : ""}`}
                onClick={() => jump(i)}
              >
                {n.name}
              </button>
            </span>
          ))}
        </nav>

        {/* 文件列表 */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {browse.isLoading ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
              正在读取 115 网盘目录...
            </div>
          ) : (browse.data?.items ?? []).length === 0 ? (
            <div className="p-12 text-center text-sm text-muted">
              该文件夹下暂无视频素材。
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(browse.data?.items ?? []).map((item) => (
                <li
                  key={item.fid}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-elevated/40"
                >
                  {item.isDir ? (
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => enter(item)}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Folder className="h-5 w-5" />
                      </div>
                      <span className="truncate text-sm font-medium">{item.name}</span>
                    </button>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-elevated">
                          {item.still ? (
                            <img src={item.still} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Video className="h-5 w-5 text-subtle" />
                            </div>
                          )}
                          {item.duration && (
                            <span className="absolute bottom-1 right-1 rounded-xs bg-bg/85 px-1 py-0.2 font-mono text-[9px] tabular text-fg">
                              {formatClock(item.duration)}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="font-mono text-[11px] text-subtle">
                            {formatBytes(item.sizeMb)} · PickCode: {item.pickCode || "—"} · {item.path}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {item.indexed ? (
                          <div className="flex items-center gap-1.5">
                            <Badge tone="ok">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              已索引入库
                            </Badge>
                            <Link
                              to="/library/$id"
                              params={{ id: item.videoId ?? "" }}
                              className="text-xs text-accent underline-offset-2 hover:underline"
                            >
                              查看
                            </Link>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={ingest.isPending}
                            onClick={() => item.videoId && ingest.mutate(item.videoId)}
                          >
                            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-accent" />
                            加入 AI 索引
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] text-subtle">{label}</span>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
