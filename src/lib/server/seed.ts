import { getSql } from "@/lib/db";
import { VIDEOS } from "@/lib/catalog";
import { MODEL_PROFILES } from "@/lib/engine/embed";
import { buildIndex } from "@/lib/engine/search";

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
  const rows = await sql<{ c: number }>`select count(*)::int as c from videos`;
  if ((rows[0]?.c ?? 0) === 0) {
    await seedCore();
  }
  const regionCount = await sql<{ c: number }>`select count(*)::int as c from regions`;
  if ((regionCount[0]?.c ?? 0) === 0) {
    await seedRegions();
  }
}

async function seedRegions() {
  const sql = await getSql();
  for (const v of VIDEOS) {
    const existing = await sql<{ id: string }>`select id from frames where video_id = ${v.id} limit 1`;
    if (existing.length === 0) {
      for (const f of v.frames) {
        await sql`
          insert into frames (id, video_id, timestamp_sec, shot_id, still_url, scene_tags, objects)
          values (
            ${f.id}, ${v.id}, ${f.t}, ${f.shot}, ${f.still},
            ${JSON.stringify(f.scene)}, ${JSON.stringify(f.objects)}
          )
        `;
      }
    }
  }
  const profile = MODEL_PROFILES["qwen3-vl-emb-8b"]!;
  const index = buildIndex(
    VIDEOS.map((v) => ({ ...v, indexed: true })),
    profile,
  );
  for (const r of index) {
    try {
      await sql`
        insert into regions (id, frame_id, video_id, view_type, person_index, bbox, attributes, vector)
        values (
          ${r.id}, ${r.frameId}, ${r.videoId}, ${r.view}, ${r.personIndex},
          ${JSON.stringify(r.bbox)},
          ${JSON.stringify({ concepts: r.concepts })},
          ${JSON.stringify(r.vector)}
        )
      `;
    } catch (err) {
      console.error("[seed] region insert failed", r.id, err);
    }
  }
  const counts = await sql<{ video_id: string; c: number }>`
    select video_id, count(*)::int as c from regions group by video_id
  `;
  for (const row of counts) {
    await sql`update videos set vector_count = ${row.c} where id = ${row.video_id}`;
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
  `;

  for (const m of MODELS) {
    await sql`
      insert into models (id, role, name, vendor, dim, languages, vram_gb, notes, active, chinese, action, expression, clothing, compound)
      values (
        ${m.id}, ${m.role}, ${m.name}, ${m.vendor}, ${m.dim},
        ${JSON.stringify(m.languages)}::jsonb, ${m.vram}, ${m.notes}, ${m.active},
        ${m.chinese}, ${m.action}, ${m.expression}, ${m.clothing}, ${m.compound}
      )
    `;
  }

  await sql`
    insert into downstream_apps (id, name, kind, enabled, config)
    values
      ('app_api', '检索 HTTP 统一接口 (/api/v1/search)', 'api', true, ${JSON.stringify({ path: "/api/v1/search" })}::jsonb),
      ('app_rag', 'Video RAG 多模态知识库片段投递', 'rag', true, ${JSON.stringify({ channel: "default", topK: 5 })}::jsonb),
      ('app_nle', '剪辑工程导出 (Final Cut Pro / Premiere)', 'export', true, ${JSON.stringify({ formats: ["fcpxml", "edl", "json"] })}::jsonb),
      ('app_hook', 'Webhook 自动化触发器', 'webhook', false, ${JSON.stringify({ url: "" })}::jsonb)
  `;

  await sql`
    insert into settings (key, value) values
      ('embed_model', ${JSON.stringify("qwen3-vl-emb-8b")}::jsonb),
      ('rerank_model', ${JSON.stringify("qwen3-vl-rerank-8b")}::jsonb),
      ('sample_fps', ${JSON.stringify(1)}::jsonb),
      ('embed_dim', ${JSON.stringify(2048)}::jsonb)
  `;

  const profile = MODEL_PROFILES["qwen3-vl-emb-8b"]!;
  const index = buildIndex(
    VIDEOS.map((v) => ({ ...v, indexed: true })),
    profile,
  );

  for (const v of VIDEOS) {
    const regions = index.filter((r) => r.videoId === v.id);
    await sql`
      insert into videos (
        id, source_id, title, filename, duration_sec, width, height,
        poster_url, status, path, pick_code, size_mb, frame_count, vector_count, indexed_at, meta
      ) values (
        ${v.id}, 'src_115_demo', ${v.title}, ${v.filename}, ${v.duration}, ${v.w}, ${v.h},
        ${v.poster}, ${v.indexed ? "ready" : "pending"}, ${v.path}, ${v.pickCode}, ${v.sizeMb},
        ${v.frames.length}, ${v.indexed ? regions.length : 0},
        ${v.indexed ? new Date().toISOString() : null},
        ${JSON.stringify({ description: v.description })}::jsonb
      )
    `;
    if (!v.indexed) continue;
    for (const f of v.frames) {
      await sql`
        insert into frames (id, video_id, timestamp_sec, shot_id, still_url, scene_tags, objects)
        values (
          ${f.id}, ${v.id}, ${f.t}, ${f.shot}, ${f.still},
          ${JSON.stringify(f.scene)}::jsonb, ${JSON.stringify(f.objects)}::jsonb
        )
      `;
    }
  }

  for (const r of index) {
    const video = VIDEOS.find((v) => v.id === r.videoId);
    if (!video?.indexed) continue;
    try {
      await sql`
        insert into regions (id, frame_id, video_id, view_type, person_index, bbox, attributes, vector)
        values (
          ${r.id}, ${r.frameId}, ${r.videoId}, ${r.view}, ${r.personIndex},
          ${JSON.stringify(r.bbox)},
          ${JSON.stringify({ concepts: r.concepts })},
          ${JSON.stringify(r.vector)}
        )
      `;
    } catch (err) {
      console.error("[seed] region insert failed", r.id, err);
    }
  }
}
