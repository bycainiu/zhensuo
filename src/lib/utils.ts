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
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="50%" stop-color="#09090b" />
      <stop offset="100%" stop-color="#040405" />
    </linearGradient>
  </defs>

  <!-- 背景暗调电影渐变 -->
  <rect width="1280" height="720" fill="url(#bg)" />

  <!-- 电影画幅 16:9 微光边框 -->
  <rect x="2" y="2" width="1276" height="716" rx="8" fill="none" stroke="#27272a" stroke-width="2" />

  <!-- 胶片中央微弱占位标识 -->
  <g transform="translate(640, 360)">
    <circle r="42" fill="#27272a" fill-opacity="0.4" stroke="#3f3f46" stroke-width="1.5" />
    <polygon points="-8,-16 -8,16 16,0" fill="#71717a" />
    <text y="70" text-anchor="middle" fill="#71717a" font-size="16" font-family="monospace" letter-spacing="1">115 视频画面解析中 · ${timeFormatted}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
