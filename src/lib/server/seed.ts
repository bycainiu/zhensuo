import { getSql } from "@/lib/db";
import { generateCinemaFrameDataUrl } from "@/lib/utils";
import { fetch115VideoRealFrames } from "@/lib/pan115/client";
import { VIDEOS } from "@/lib/catalog";
import type { ViewType } from "@/lib/types";

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

const FALLBACK_STILLS = [
  "/stills/jacket-phone.jpg",
  "/stills/rain-run.jpg",
  "/stills/basketball.jpg",
  "/stills/chef.jpg",
  "/stills/doctor.jpg",
  "/stills/forklift.jpg",
  "/stills/red-dress.jpg",
  "/stills/office.jpg",
  "/stills/studio.jpg",
  "/stills/downjacket.jpg",
];

// 修复任务的进程内节流：115 拉图失败时避免每个请求都串行重试拖垮列表接口
const REPAIR_INTERVAL_MS = 120_000;
let lastRepairAt = 0;
let repairInFlight = false;

export async function seedIfEmpty() {
  const sql = await getSql();

  const modelCount = await sql<{ c: number }>`select count(*)::int as c from models`;
  if ((modelCount[0]?.c ?? 0) === 0) {
    await seedCore();
  }

  const videoCount = await sql<{ c: number }>`select count(*)::int as c from videos`;
  if ((videoCount[0]?.c ?? 0) === 0) {
    await seedVideos();
  } else if (!repairInFlight && Date.now() - lastRepairAt > REPAIR_INTERVAL_MS) {
    // 检查并自动修复数据库中已存在的占位 SVG 图片为真实电影画幅帧
    lastRepairAt = Date.now();
    repairInFlight = true;
    try {
      await repairSvgPlaceholders();
    } finally {
      repairInFlight = false;
    }
  }
}

async function repairSvgPlaceholders() {
  const sql = await getSql();
  const catalogMap = new Map(VIDEOS.map((v) => [v.id, v]));

  // 查询 115 凭证
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

  const allVideos = await sql<{ id: string; title: string; poster_url: string; pick_code: string; meta: unknown }>`
    select id, title, poster_url, pick_code, meta from videos
  `;

  for (let i = 0; i < allVideos.length; i++) {
    const sv = allVideos[i]!;
    const cat = catalogMap.get(sv.id);
    const meta = sv.meta as { pickCode?: string } | null;
    const pc = sv.pick_code || meta?.pickCode || sv.id.replace("vid_115_", "");

    let newPoster = sv.poster_url;

    if (cat) {
      // 预置演示成片
      if (!newPoster || newPoster.startsWith("data:image/svg")) {
        newPoster = cat.poster;
        await sql`update videos set poster_url = ${newPoster} where id = ${sv.id}`;
      }
    } else {
      // 115 导入视频：必须抓取真实网盘画面，绝不覆盖为演示素材图
      if (!newPoster || newPoster.startsWith("data:image/svg") || newPoster.startsWith("/stills/")) {
        let gotReal = false;
        if (cookie && pc) {
          try {
            const real115 = await fetch115VideoRealFrames(cookie, pc);
            if (real115.poster) {
              newPoster = real115.poster;
              gotReal = true;
              await sql`update videos set poster_url = ${newPoster} where id = ${sv.id}`;
            }
          } catch {}
        }
        // 旧版本遗留的演示图脏数据：115 拉不到真图时替换为诚实占位，绝不冒充真实画面
        if (!gotReal && newPoster.startsWith("/stills/")) {
          newPoster = generateCinemaFrameDataUrl(sv.title, pc, 0);
          await sql`update videos set poster_url = ${newPoster} where id = ${sv.id}`;
        }
      }
    }

    // 修复采样帧
    const frames = await sql<{ id: string; still_url: string; timestamp_sec: number }>`
      select id, still_url, timestamp_sec from frames where video_id = ${sv.id} order by timestamp_sec asc
    `;

    for (let fIdx = 0; fIdx < frames.length; fIdx++) {
      const f = frames[fIdx]!;
      if (cat) {
        if (!f.still_url || f.still_url.startsWith("data:image/svg")) {
          const catFrame = cat.frames[fIdx];
          const newStill = catFrame?.still || newPoster;
          await sql`update frames set still_url = ${newStill} where id = ${f.id}`;
        }
      } else if (newPoster && !newPoster.startsWith("/stills/") && !newPoster.startsWith("data:image/svg")) {
        if (!f.still_url || f.still_url.startsWith("data:image/svg") || f.still_url.startsWith("/stills/")) {
          await sql`update frames set still_url = ${newPoster} where id = ${f.id}`;
        }
      } else if (f.still_url && f.still_url.startsWith("/stills/")) {
        // 115 视频帧上的旧演示图脏数据：无真实画面时替换为诚实占位
        const honest = generateCinemaFrameDataUrl(sv.title, pc, Number(f.timestamp_sec));
        await sql`update frames set still_url = ${honest} where id = ${f.id}`;
      }
    }
  }
}

async function seedVideos() {
  const sql = await getSql();

  for (const v of VIDEOS) {
    await sql`
      insert into videos (
        id, source_id, title, filename, duration_sec, width, height,
        poster_url, status, path, pick_code, size_mb, frame_count, vector_count, meta
      ) values (
        ${v.id}, 'src_115_qr', ${v.title}, ${v.filename}, ${v.duration}, ${v.w}, ${v.h},
        ${v.poster}, 'ready', ${v.path}, ${v.pickCode}, ${v.sizeMb},
        ${v.frames.length}, ${v.frames.length * 4},
        ${JSON.stringify({ pickCode: v.pickCode, filename: v.filename, description: v.description })}::jsonb
      )
      on conflict (id) do nothing
    `;

    for (const f of v.frames) {
      await sql`
        insert into frames (id, video_id, timestamp_sec, shot_id, still_url, scene_tags, objects)
        values (
          ${f.id}, ${v.id}, ${f.t}, ${f.shot}, ${f.still},
          ${JSON.stringify(f.scene)}::jsonb,
          ${JSON.stringify(f.objects)}::jsonb
        )
        on conflict (id) do nothing
      `;

      const views: ViewType[] = ["global", "person_context", "person_tight", "face"];
      for (const view of views) {
        const regId = `reg_${f.id}_${view}`;
        const p0 = f.persons[0];
        const bbox =
          view === "global"
            ? null
            : view === "person_context"
              ? { x: 0.15, y: 0.08, w: 0.7, h: 0.85 }
              : view === "person_tight"
                ? (p0?.bbox ?? { x: 0.25, y: 0.15, w: 0.5, h: 0.7 })
                : (p0?.faceBbox ?? { x: 0.35, y: 0.12, w: 0.25, h: 0.25 });

        const vec = new Array(2048).fill(0).map(() => Math.round((Math.random() * 0.2 - 0.1) * 10000) / 10000);
        await sql`
          insert into regions (id, frame_id, video_id, view_type, person_index, bbox, attributes, vector)
          values (
            ${regId}, ${f.id}, ${v.id}, ${view}, 0,
            ${JSON.stringify(bbox)}::jsonb,
            ${JSON.stringify({ title: v.title, filename: v.filename, view, concepts: p0?.concepts ?? [] })}::jsonb,
            ${JSON.stringify(vec)}::jsonb
          )
          on conflict (id) do nothing
        `;
      }
    }
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
