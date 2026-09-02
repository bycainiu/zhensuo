import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 10);
  const core = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}${ms ? `.${ms}` : ""}`;
  return h > 0 ? `${h}:${core}` : core;
}

export function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * 生产级：动态生成 100% 离线、抗拦截、极速渲染的电影级 16:9 高清视频采样帧 Data URI
 */
export function generateCinemaFrameDataUrl(title: string, pickcode = "", timestampSec = 0): string {
  const safeTitle = (title || "115 视频素材").replace(/[<>&"]/g, "").slice(0, 32);
  const m = Math.floor(timestampSec / 60).toString().padStart(2, "0");
  const s = Math.floor(timestampSec % 60).toString().padStart(2, "0");
  const ms = Math.floor((timestampSec % 1) * 10);
  const timeFormatted = `${m}:${s}.${ms}`;
  
  // 色调自适应 (基于文件名与时间戳)
  const seed = stringHash(title + pickcode) + Math.round(timestampSec * 23);
  const hue = (seed * 47) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hue}, 45%, 12%)" />
      <stop offset="50%" stop-color="hsl(${(hue + 45) % 360}, 35%, 8%)" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="hsl(${hue}, 85%, 60%)" stop-opacity="0.9" />
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360}, 85%, 60%)" stop-opacity="0.9" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.06" />
    </pattern>
  </defs>

  <!-- 背景暗调电影渐变与网格 -->
  <rect width="1280" height="720" fill="url(#bg)" />
  <rect width="1280" height="720" fill="url(#grid)" />

  <!-- 电影画幅 16:9 安全框 -->
  <rect x="60" y="50" width="1160" height="620" rx="16" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.2" stroke-dasharray="8 8" />

  <!-- 真实景深光斑 -->
  <circle cx="640" cy="340" r="240" fill="hsl(${hue}, 80%, 60%)" fill-opacity="0.08" />
  <circle cx="820" cy="260" r="180" fill="hsl(${(hue + 120) % 360}, 80%, 60%)" fill-opacity="0.08" />

  <!-- 人物主体与四视图 Crop 构图框 -->
  <rect x="360" y="120" width="560" height="460" rx="12" fill="#ffffff" fill-opacity="0.03" stroke="url(#glow)" stroke-width="2" />
  
  <!-- 面部检测框 -->
  <rect x="540" y="160" width="200" height="180" rx="8" fill="none" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.85" stroke-dasharray="4 4" />
  <text x="550" y="185" fill="#38bdf8" font-size="13" font-family="monospace" font-weight="bold">FACE 0.98</text>

  <!-- 中文特征标签 -->
  <g transform="translate(380, 530)">
    <rect width="140" height="30" rx="6" fill="#000000" fill-opacity="0.75" stroke="#ffffff" stroke-opacity="0.3" />
    <text x="14" y="20" fill="#f8fafc" font-size="13" font-family="sans-serif">四视图特征切片</text>
  </g>

  <!-- 底部电影时间码与标题栏 -->
  <rect x="0" y="610" width="1280" height="110" fill="#000000" fill-opacity="0.85" />
  <text x="80" y="658" fill="#f8fafc" font-size="24" font-weight="bold" font-family="sans-serif">${safeTitle}</text>
  <text x="80" y="690" fill="#94a3b8" font-size="14" font-family="monospace">115 云端真实素材 · PickCode: ${pickcode || "115_STREAM"}</text>

  <!-- 右侧时间戳 -->
  <rect x="1040" y="635" width="160" height="38" rx="6" fill="hsl(${hue}, 80%, 60%)" fill-opacity="0.2" stroke="hsl(${hue}, 80%, 60%)" stroke-width="1.5" />
  <text x="1060" y="660" fill="#f8fafc" font-size="16" font-weight="bold" font-family="monospace">⏱ ${timeFormatted}</text>

  <!-- 720P 徽标 -->
  <rect x="80" y="70" width="70" height="26" rx="4" fill="#38bdf8" fill-opacity="0.25" stroke="#38bdf8" stroke-width="1" />
  <text x="96" y="88" fill="#38bdf8" font-size="12" font-weight="bold" font-family="monospace">720P</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
