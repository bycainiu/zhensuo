/**
 * 115 图片同源代理：/api/pan115/img?url=<115 直链> 或 /api/pan115/img?pc=<pickcode>
 *
 * 浏览器直连 115 图床会被防盗链 (Cookie/Referer 校验) 与无 CORS 响应头拦截，
 * 统一由本地服务端携带 115 凭证抓取后原样回传图片字节，
 * 前端 <img> 全部走同源地址，彻底规避防盗链 / mixed content / CORS 失败。
 */
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { fetch115ImageBytes, getGlobal115Cookie, setGlobal115Cookie } from "@/lib/pan115/client";

async function resolveCookie(): Promise<string> {
  let cookie = getGlobal115Cookie();
  if (cookie) return cookie;
  const sql = await getSql();
  const sources = await sql<{ config: unknown }>`
    select config from sources where id in ('src_115_qr', 'src_115_cookie') and status = 'connected'
  `;
  for (const s of sources) {
    let cfg: { cookie?: string } = {};
    try {
      cfg = typeof s.config === "string" ? JSON.parse(s.config) : (s.config as { cookie?: string }) ?? {};
    } catch {
      continue;
    }
    if (cfg.cookie) {
      setGlobal115Cookie(cfg.cookie);
      return cfg.cookie;
    }
  }
  return "";
}

export const Route = createFileRoute("/api/pan115/img")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const target = (reqUrl.searchParams.get("url") || "").trim();
        const pickcode = (reqUrl.searchParams.get("pc") || "").trim();

        if (!target && !pickcode) {
          return new Response(JSON.stringify({ error: "缺少 url 或 pc 参数" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 只代理 115 域名的图片直链，避免被滥用为开放代理
        if (target) {
          let host = "";
          try {
            host = new URL(target).hostname;
          } catch {
            return new Response(JSON.stringify({ error: "url 参数不是合法直链" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (!/115/i.test(host)) {
            return new Response(JSON.stringify({ error: `仅允许代理 115 域名图片，收到: ${host}` }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        const cookie = await resolveCookie();
        if (!cookie && !pickcode) {
          return new Response(JSON.stringify({ error: "115 Cookie 未连接，请先在「素材源」页登录 115 账号" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const img = await fetch115ImageBytes(cookie, target || pickcode);
          if (!img) {
            return new Response(JSON.stringify({ error: "115 图床拉取失败 (凭证失效或图片不存在)" }), {
              status: 502,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(img.bytes, {
            status: 200,
            headers: {
              "Content-Type": img.contentType,
              "Cache-Control": "private, max-age=86400",
            },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "代理抓取异常" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
