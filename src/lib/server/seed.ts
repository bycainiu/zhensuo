import { getSql } from "@/lib/db";
import { generateCinemaFrameDataUrl } from "@/lib/utils";
import { fetch115VideoRealFrames } from "@/lib/pan115/client";

const MODELS = [
  {
    id: "qwen3-vl-emb-8b",
    role: "embedding",
    name: "Qwen3-VL-Embedding-8B",
    vendor: "Qwen",
    dim: 2048,
    languages: ["zh", "en", "33-lang"],
    vram: 24,
    notes: "主模型。Instruction-aware，MRL 64–4096 维，中文与细粒度人物属性最强。",
    active: true,
    chinese: "strong",
    action: 1,
    expression: 0.96,
    clothing: 1,
    compound: 1,
  },
  {
    id: "qwen3-vl-emb-2b",
    role: "embedding",
    name: "Qwen3-VL-Embedding-2B",
    vendor: "Qwen",
    dim: 2048,
    languages: ["zh", "en"],
    vram: 12,
    notes: "同系列轻量，吞吐更高，细粒度略降。",
    active: false,
    chinese: "strong",
    action: 0.9,
    expression: 0.86,
    clothing: 0.94,
    compound: 0.88,
  },
  {
    id: "jina-clip-v2",
    role: "embedding",
    name: "Jina CLIP v2",
    vendor: "Jina",
    dim: 1024,
    languages: ["zh", "89-lang"],
    vram: 8,
    notes: "0.9B / 512px，吞吐优先的 frame baseline。表情与复合条件较弱。",
    active: false,
    chinese: "multi",
    action: 0.78,
    expression: 0.55,
    clothing: 0.9,
    compound: 0.7,
  },
  {
    id: "chinese-clip-l14",
    role: "embedding",
    name: "Chinese-CLIP ViT-L/14",
    vendor: "OFA-Sys",
    dim: 768,
    languages: ["zh"],
    vram: 8,
    notes: "中文图文 baseline，动作/神态上限低于 Qwen3-VL-Embedding。",
    active: false,
    chinese: "strong",
    action: 0.7,
    expression: 0.48,
    clothing: 0.88,
    compound: 0.62,
  },
  {
    id: "siglip2-large",
    role: "embedding",
    name: "SigLIP 2 Large",
    vendor: "Google",
    dim: 1152,
    languages: ["multi"],
    vram: 12,
    notes: "多语言图像 baseline，中文 query 需配合指令或翻译。",
    active: false,
    chinese: "multi",
    action: 0.82,
    expression: 0.6,
    clothing: 0.92,
    compound: 0.74,
  },
  {
    id: "qwen3-vl-rerank-8b",
    role: "reranker",
    name: "Qwen3-VL-Reranker-8B",
    vendor: "Qwen",
    dim: null,
    languages: ["zh", "en"],
    vram: 24,
    notes: "Cross-encoder。可一次读入 global + context + tight + face 四视图。",
    active: true,
    chinese: "strong",
    action: 1,
    expression: 1,
    clothing: 1,
    compound: 1,
  },
  {
    id: "qwen3-vl-rerank-2b",
    role: "reranker",
    name: "Qwen3-VL-Reranker-2B",
    vendor: "Qwen",
    dim: null,
    languages: ["zh", "en"],
    vram: 12,
    notes: "轻量精排，适合单卡 24GB 与 Embedding 分时复用。",
    active: false,
    chinese: "strong",
    action: 0.9,
    expression: 0.9,
    clothing: 0.9,
    compound: 0.9,
  },
];

export async function seedIfEmpty() {
  const sql = await getSql();

  // 获取已连接的 115 Cookie 凭证
  const sources = await sql<{ config: unknown }>`
    select config from sources where id in ('src_115_qr', 'src_115_cookie') and status = 'connected'
  `;
  let cookie = "";
  for (const s of sources) {
    const cfg = typeof s.config === "string" ? JSON.parse(s.config) : s.config;
    if (cfg?.cookie) {
      cookie = cfg.cookie;
      break;
    }
  }

  // 自动拉取真实 115 视频画面帧并更新到数据库
  const allVideos = await sql<{ id: string; title: string; pick_code: string; meta: unknown }>`
    select id, title, pick_code, meta from videos
  `;
  for (const sv of allVideos) {
    const meta = sv.meta as { pickCode?: string } | null;
    const pc = sv.pick_code || meta?.pickCode || sv.id.replace("vid_115_", "");
    
    // 优先从 115 官方拉取真实 Base64 画面帧
    const real115 = await fetch115VideoRealFrames(cookie, pc);
    const posterUrl = real115.poster || generateCinemaFrameDataUrl(sv.title, pc, 0);

    await sql`update videos set poster_url = ${posterUrl}, pick_code = ${pc} where id = ${sv.id}`;
    
    // 更新该视频的所有抽帧图像为真实网盘帧
    const frames = await sql<{ id: string; timestamp_sec: number }>`
      select id, timestamp_sec from frames where video_id = ${sv.id} order by timestamp_sec asc
    `;
    for (let idx = 0; idx < frames.length; idx++) {
      const f = frames[idx]!;
      const frameStill = real115.frames[idx] || real115.poster || generateCinemaFrameDataUrl(sv.title, pc, Number(f.timestamp_sec));
      await sql`update frames set still_url = ${frameStill} where id = ${f.id}`;
    }
  }

  const modelCount = await sql<{ c: number }>`select count(*)::int as c from models`;
  if ((modelCount[0]?.c ?? 0) === 0) {
    await seedCore();
  }
}

async function seedCore() {
  const sql = await getSql();

  await sql`
    insert into sources (id, kind, name, status, config)
    values
      ('src_115_qr', '115_qr', '115 扫码登录 (苹果/Web)', 'disconnected', '{}'::jsonb),
      ('src_115_cookie', '115_cookie', '115 Cookie 直连', 'disconnected', '{}'::jsonb),
      ('src_115_open', '115_open', '115 开放平台 (OAuth)', 'disconnected', '{}'::jsonb),
      ('src_upload', 'upload', '本地素材导入', 'disconnected', '{}'::jsonb)
    on conflict (id) do nothing
  `;

  for (const m of MODELS) {
    await sql`
      insert into models (id, role, name, vendor, dim, languages, vram_gb, notes, active, chinese, action, expression, clothing, compound)
      values (
        ${m.id}, ${m.role}, ${m.name}, ${m.vendor}, ${m.dim},
        ${JSON.stringify(m.languages)}::jsonb, ${m.vram}, ${m.notes}, ${m.active},
        ${m.chinese}, ${m.action}, ${m.expression}, ${m.clothing}, ${m.compound}
      )
      on conflict (id) do nothing
    `;
  }

  await sql`
    insert into downstream_apps (id, name, kind, enabled, config)
    values
      ('app_api', '检索 HTTP 统一接口 (/api/v1/search)', 'api', true, ${JSON.stringify({ path: "/api/v1/search" })}::jsonb),
      ('app_rag', 'Video RAG 多模态知识库片段投递', 'rag', true, ${JSON.stringify({ channel: "default", topK: 5 })}::jsonb),
      ('app_nle', '剪辑工程导出 (Final Cut Pro / Premiere)', 'export', true, ${JSON.stringify({ formats: ["fcpxml", "edl", "json"] })}::jsonb),
      ('app_hook', 'Webhook 自动化触发器', 'webhook', false, ${JSON.stringify({ url: "" })}::jsonb)
    on conflict (id) do nothing
  `;

  await sql`
    insert into settings (key, value) values
      ('embed_model', ${JSON.stringify("qwen3-vl-emb-8b")}::jsonb),
      ('rerank_model', ${JSON.stringify("qwen3-vl-rerank-8b")}::jsonb),
      ('sample_fps', ${JSON.stringify(1)}::jsonb),
      ('embed_dim', ${JSON.stringify(2048)}::jsonb),
      ('colab_url', ${JSON.stringify("http://100.92.54.15:8000")}::jsonb)
    on conflict (key) do nothing
  `;
}
