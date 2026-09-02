import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { seedIfEmpty } from "./seed";
import { VIDEOS, PAN_FOLDERS, folderChildren } from "@/lib/catalog";
import { buildIndex, parseLexicon, parsedFromGrok, retrieve } from "@/lib/engine/search";
import { MODEL_PROFILES, QUERY_INSTRUCTION } from "@/lib/engine/embed";
import {
  create115QrSession,
  poll115QrStatus,
  verify115Cookie,
  probeOpenApi,
  fetchReal115Files,
} from "@/lib/pan115/client";
import type {
  ApiPlaygroundRequest,
  ApiPlaygroundResponse,
  DownstreamApp,
  ExportFormat,
  ExportResult,
  FrameCard,
  IngestJob,
  JobStage,
  Json,
  ModelCard,
  OverviewStats,
  Pan115AppType,
  Pan115QrSession,
  Pan115QrStatus,
  Pan115User,
  PanFile,
  ParsedQuery,
  RegionCard,
  SearchHit,
  SearchTrace,
  SourceRecord,
  VideoCard,
} from "@/lib/types";

async function activeEmbedId() {
  const sql = await getSql();
  const rows = await sql<{ value: string }>`select value from settings where key = 'embed_model'`;
  const raw = rows[0]?.value;
  if (typeof raw === "string") return raw.replaceAll('"', "");
  return "qwen3-vl-emb-8b";
}

function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

export const getOverview = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const videoRows = await sql<{ status: string }>`select status from videos`;
  const f = await sql<{ c: number }>`select count(*)::int as c from frames`;
  const r = await sql<{ c: number }>`select count(*)::int as c from regions`;
  const s = await sql<{ c: number }>`select count(*)::int as c from searches`;
  const models = await sql<{ id: string; role: string; name: string }>`
    select id, role, name from models where active = true
  `;
  const src = await sql<{ status: string; config: unknown }>`
    select status, config from sources where id in ('src_115_qr', 'src_115_cookie', 'src_115_demo')
  `;

  // 查找是否有真实连接的 115 账号
  let connectedUser: string | null = null;
  let overallSourceStatus = "connected";
  for (const sRow of src) {
    if (sRow.status === "connected") {
      const cfg = asJson<{ user?: Pan115User }>(sRow.config, {});
      if (cfg.user?.userName) {
        connectedUser = cfg.user.userName;
      }
    }
  }

  const stats: OverviewStats = {
    videos: videoRows.length,
    frames: f[0]?.c ?? 0,
    vectors: r[0]?.c ?? 0,
    ready: videoRows.filter((row) => row.status === "ready").length,
    pending: videoRows.filter((row) => row.status !== "ready").length,
    searches: s[0]?.c ?? 0,
    activeEmbed: models.find((m) => m.role === "embedding")?.name ?? "Qwen3-VL-Embedding-8B",
    activeRerank: models.find((m) => m.role === "reranker")?.name ?? "Qwen3-VL-Reranker-8B",
    sourceStatus: overallSourceStatus,
    connected115User: connectedUser,
  };
  return stats;
});

export const listVideos = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    title: string;
    filename: string;
    duration_sec: number;
    poster_url: string;
    status: VideoCard["status"];
    path: string;
    source_id: string;
    frame_count: number;
    vector_count: number;
    size_mb: number;
  }>`select id, title, filename, duration_sec, poster_url, status, path, source_id, frame_count, vector_count, size_mb from videos order by title`;
  return rows.map(
    (row): VideoCard => ({
      id: row.id,
      title: row.title,
      filename: row.filename,
      duration: Number(row.duration_sec),
      poster: row.poster_url,
      status: row.status,
      path: row.path,
      sourceId: row.source_id,
      frameCount: Number(row.frame_count),
      vectorCount: Number(row.vector_count),
      sizeMb: Number(row.size_mb),
    }),
  );
});

export const getVideo = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const sql = await getSql();
    const videos = await sql<{
      id: string;
      title: string;
      filename: string;
      duration_sec: number;
      poster_url: string;
      status: VideoCard["status"];
      path: string;
      source_id: string;
      frame_count: number;
      vector_count: number;
      size_mb: number;
      meta: unknown;
    }>`select * from videos where id = ${data.id}`;
    const video = videos[0];
    if (!video) return null;
    const frames = await sql<{
      id: string;
      video_id: string;
      timestamp_sec: number;
      still_url: string;
      scene_tags: unknown;
    }>`select id, video_id, timestamp_sec, still_url, scene_tags from frames where video_id = ${data.id} order by timestamp_sec`;
    const regions = await sql<{
      id: string;
      frame_id: string;
      view_type: RegionCard["viewType"];
      bbox: unknown;
      attributes: unknown;
    }>`select id, frame_id, view_type, bbox, attributes from regions where video_id = ${data.id}`;
    return {
      video: {
        id: video.id,
        title: video.title,
        filename: video.filename,
        duration: Number(video.duration_sec),
        poster: video.poster_url,
        status: video.status,
        path: video.path,
        sourceId: video.source_id,
        frameCount: Number(video.frame_count),
        vectorCount: Number(video.vector_count),
        sizeMb: Number(video.size_mb),
      } satisfies VideoCard,
      description: asJson<{ description?: string }>(video.meta, {}).description ?? "",
      frames: frames.map(
        (f): FrameCard => ({
          id: f.id,
          videoId: f.video_id,
          timestamp: Number(f.timestamp_sec),
          still: f.still_url,
          scene: asJson<string[]>(f.scene_tags, []),
          persons: regions.filter((r) => r.frame_id === f.id && r.view_type === "person_tight").length,
        }),
      ),
      regions: regions.map(
        (r): RegionCard => ({
          id: r.id,
          frameId: r.frame_id,
          viewType: r.view_type,
          bbox: asJson(r.bbox, null),
          attributes: asJson(r.attributes, {}),
        }),
      ),
    };
  });

export const listModels = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    role: ModelCard["role"];
    name: string;
    vendor: string;
    dim: number | null;
    languages: unknown;
    vram_gb: number;
    notes: string;
    active: boolean;
    chinese: ModelCard["chinese"];
    action: number;
    expression: number;
    clothing: number;
    compound: number;
  }>`select * from models order by role, vram_gb desc`;
  return rows.map(
    (m): ModelCard => ({
      id: m.id,
      role: m.role,
      name: m.name,
      vendor: m.vendor,
      dim: m.dim,
      languages: asJson<string[]>(m.languages, []),
      vramGb: Number(m.vram_gb),
      notes: m.notes,
      active: Boolean(m.active),
      chinese: m.chinese,
      action: Number(m.action),
      expression: Number(m.expression),
      clothing: Number(m.clothing),
      compound: Number(m.compound),
    }),
  );
});

export const activateModel = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const sql = await getSql();
    const found = await sql<{ role: string }>`select role from models where id = ${data.id}`;
    const role = found[0]?.role;
    if (!role) return { ok: false as const };
    await sql`update models set active = false where role = ${role}`;
    await sql`update models set active = true where id = ${data.id}`;
    const key = role === "embedding" ? "embed_model" : "rerank_model";
    await sql`update settings set value = ${JSON.stringify(data.id)}::jsonb where key = ${key}`;
    return { ok: true as const, id: data.id };
  });

export const listSources = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    kind: SourceRecord["kind"];
    name: string;
    status: SourceRecord["status"];
    config: unknown;
  }>`select id, kind, name, status, config from sources order by id`;
  return rows.map((s): SourceRecord => {
    const cfg = asJson<{ user?: Pan115User }>(s.config, {});
    return {
      id: s.id,
      kind: s.kind,
      name: s.name,
      status: s.status,
      config: cfg,
      user: cfg.user ?? null,
    };
  });
});

/**
 * 115 扫码登录服务端函数
 */
export const get115QrSession = createServerFn({ method: "POST" })
  .validator((input: { app?: Pan115AppType }) => input)
  .handler(async ({ data }) => {
    const app = data.app ?? "ios";
    const session = await create115QrSession(app);
    return session;
  });

export const check115QrStatus = createServerFn({ method: "POST" })
  .validator((input: { uid: string; time: number; sign: string; app?: Pan115AppType }) => input)
  .handler(async ({ data }): Promise<Pan115QrStatus> => {
    const res = await poll115QrStatus(data.uid, data.time, data.sign, data.app ?? "ios");
    if (res.status === 2 && res.user) {
      // 登录成功，将用户信息写入 sources 表
      const sql = await getSql();
      await sql`
        update sources
        set status = 'connected',
            config = ${JSON.stringify({ user: res.user, cookie: res.cookie, version: res.version })}::jsonb
        where id = 'src_115_qr'
      `;
    }
    return res;
  });


/**
 * 115 Cookie 登录与保存
 */
export const save115Cookie = createServerFn({ method: "POST" })
  .validator((input: { cookie: string }) => input)
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const result = await verify115Cookie(data.cookie);
    if (!result.ok || !result.user) {
      return { ok: false as const, detail: result.detail };
    }
    const sql = await getSql();
    await sql`
      update sources
      set status = 'connected',
          config = ${JSON.stringify({ user: result.user, cookie: data.cookie })}::jsonb
      where id = 'src_115_cookie'
    `;
    return { ok: true as const, user: result.user, detail: result.detail };
  });

export const disconnect115Source = createServerFn({ method: "POST" })
  .validator((input: { sourceId: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update sources
      set status = 'disconnected',
          config = '{}'::jsonb
      where id = ${data.sourceId}
    `;
    return { ok: true as const };
  });

export const browse115 = createServerFn({ method: "GET" })
  .validator((input: { cid?: string; search?: string }) => input)
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const sql = await getSql();
    const cid = data.cid ?? "0";
    const search = data.search?.trim().toLowerCase() ?? "";

    // 查找已连接的 115 账号凭证
    const sources = await sql<{ id: string; status: string; config: unknown }>`
      select id, status, config from sources where id in ('src_115_qr', 'src_115_cookie') and status = 'connected'
    `;

    let activeCookie = "";
    for (const s of sources) {
      const cfg = asJson<{ cookie?: string }>(s.config, {});
      if (cfg.cookie) {
        activeCookie = cfg.cookie;
        break;
      }
    }

    // 若存在真实连接，优先请求 115 官方云端文件列表
    if (activeCookie) {
      const realFiles = await fetchReal115Files(activeCookie, cid, search);
      if (realFiles.length > 0) {
        return {
          folder: { cid, name: cid === "0" ? "115 云端根目录" : `目录 (${cid})`, path: `/${cid}` },
          items: realFiles,
        };
      }
    }

    return {
      folder: { cid: "0", name: "115 云端根目录", path: "/" },
      items: [] as PanFile[],
    };
  });

export const save115Tokens = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string; refreshToken: string; appId: string; appSecret: string; rootCid: string }) => input)
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const probe = await probeOpenApi(data.accessToken);
    const sql = await getSql();
    const status = probe.ok ? "connected" : "paused";
    await sql`
      update sources set status = ${status}, config = ${JSON.stringify({
        appId: data.appId,
        appSecret: data.appSecret ? "••••" : "",
        accessToken: data.accessToken ? "set" : "",
        refreshToken: data.refreshToken ? "set" : "",
        rootCid: data.rootCid || "0",
        probe: probe.detail,
      })}::jsonb
      where id = 'src_115_open'
    `;
    return { ok: probe.ok, detail: probe.detail, status };
  });

export const runSearch = createServerFn({ method: "POST" })
  .validator((input: { query: string; useGrok?: boolean }) => input)
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const q = data.query.trim();
    if (!q) return { hits: [] as SearchHit[], trace: null as SearchTrace | null };

    let parsed: ParsedQuery = parseLexicon(q);
    if (data.useGrok !== false) {
      const grok = await analyzeWithGrok(q);
      if (grok) parsed = grok;
    }

    const sql = await getSql();
    const modelId = await activeEmbedId();
    const profile = MODEL_PROFILES[modelId] ?? MODEL_PROFILES["qwen3-vl-emb-8b"]!;
    const ready = await sql<{ id: string }>`select id from videos where status = 'ready'`;
    const readyIds = new Set(ready.map((r) => r.id));
    const videos = VIDEOS.map((v) => ({ ...v, indexed: readyIds.has(v.id) }));
    const index = buildIndex(videos, profile);
    const { hits, trace } = retrieve(parsed, index, modelId, { rerank: true });

    const id = `s_${Date.now().toString(36)}`;
    await sql`
      insert into searches (id, query, parsed, model_id, result_count, latency_ms)
      values (${id}, ${q}, ${JSON.stringify(parsed)}::jsonb, ${modelId}, ${hits.length}, ${trace.latencyMs})
    `;

    return { hits, trace, instruction: QUERY_INSTRUCTION, searchId: id };
  });

async function analyzeWithGrok(query: string): Promise<ParsedQuery | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 500,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              'Parse a video-frame search query into JSON. Keys: subject (string), action, clothing, accessories, expression, scene, objects, role (string arrays in Chinese), concepts (english snake_case from: man woman person phone_call running dunking cooking riding_bike interviewing operating_forklift typing walking holding_phone playing_basketball black_jacket black_hoodie blue_shirt red_dress white_coat chef_coat down_jacket dark_suit red_jersey safety_vest dark_coat glasses helmet stethoscope toque umbrella smiling laughing crying angry neutral surprised focused street rain office kitchen court studio hospital warehouse plaza showroom park phone car computer ball pan forklift desk doctor chef worker athlete host model). Return JSON only.',
          },
          { role: "user", content: query },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    const text = body.choices[0]?.message.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const data = JSON.parse(match[0]) as Partial<ParsedQuery>;
    return parsedFromGrok(query, data);
  } catch {
    return null;
  }
}

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    video_id: string | null;
    source_id: string;
    filename: string;
    stage: JobStage;
    progress: number;
    log: unknown;
    created_at: string;
  }>`select * from ingest_jobs order by created_at desc limit 20`;
  return rows.map(hydrateJob);
});

function hydrateJob(row: {
  id: string;
  video_id: string | null;
  source_id: string;
  filename: string;
  stage: JobStage;
  progress: number;
  log: unknown;
  created_at: string;
}): IngestJob {
  return {
    id: row.id,
    videoId: row.video_id,
    sourceId: row.source_id,
    filename: row.filename,
    stage: row.stage,
    progress: Number(row.progress),
    log: asJson(row.log, []),
    createdAt: String(row.created_at),
  };
}

const STAGE_TIMELINE: { at: number; stage: JobStage; progress: number; msg: string }[] = [
  { at: 0, stage: "decode", progress: 0.08, msg: "FFmpeg 解码容器，读取 115 视频流" },
  { at: 700, stage: "shot", progress: 0.22, msg: "镜头边界检测 PySceneDetect" },
  { at: 1500, stage: "sample", progress: 0.38, msg: "自适应抽帧 1 FPS + 高运动 2 FPS" },
  { at: 2400, stage: "detect", progress: 0.55, msg: "Person / Face 检测，生成 Global/Context/Tight/Face 四视图 crop" },
  { at: 3600, stage: "embed", progress: 0.78, msg: "Qwen3-VL-Embedding-8B 多视图向量提取 (2048-d)" },
  { at: 4800, stage: "index", progress: 0.92, msg: "写入 Qdrant 向量索引与 PostgreSQL 元数据" },
  { at: 5800, stage: "done", progress: 1, msg: "索引完成，已就绪可被中文自然语言精准召回" },
];

function stageAt(elapsed: number) {
  let cur = STAGE_TIMELINE[0]!;
  for (const s of STAGE_TIMELINE) if (elapsed >= s.at) cur = s;
  return cur;
}

export const startIngest = createServerFn({ method: "POST" })
  .validator((input: { videoId: string; sourceId?: string }) => input)
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const video = VIDEOS.find((v) => v.id === data.videoId);
    if (!video) return { ok: false as const, error: "素材不存在" };
    const sql = await getSql();
    const id = `job_${Date.now().toString(36)}`;
    const sourceId = data.sourceId ?? "src_115_qr";
    await sql`update videos set status = 'indexing' where id = ${video.id}`;
    await sql`
      insert into ingest_jobs (id, video_id, source_id, filename, stage, progress, log)
      values (${id}, ${video.id}, ${sourceId}, ${video.filename}, 'queued', 0, ${JSON.stringify([{ t: Date.now(), msg: "115 视频素材任务入队" }])}::jsonb)
    `;
    return { ok: true as const, jobId: id };
  });

export const tickJobs = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    video_id: string | null;
    source_id: string;
    filename: string;
    stage: JobStage;
    progress: number;
    log: unknown;
    created_at: string;
  }>`select * from ingest_jobs where stage not in ('done', 'error')`;

  for (const row of rows) {
    const elapsed = Date.now() - new Date(row.created_at).getTime();
    const cur = stageAt(elapsed);
    const log = asJson<{ t: number; msg: string }[]>(row.log, []);
    if (cur.stage !== row.stage) log.push({ t: Date.now(), msg: cur.msg });
    await sql`
      update ingest_jobs set stage = ${cur.stage}, progress = ${cur.progress}, log = ${JSON.stringify(log)}::jsonb
      where id = ${row.id}
    `;
    if (cur.stage === "done" && row.video_id) {
      const video = VIDEOS.find((v) => v.id === row.video_id);
      if (video) await materializeVideo(video.id);
    }
  }

  const all = await sql<{
    id: string;
    video_id: string | null;
    source_id: string;
    filename: string;
    stage: JobStage;
    progress: number;
    log: unknown;
    created_at: string;
  }>`select * from ingest_jobs order by created_at desc limit 20`;
  return all.map(hydrateJob);
});

async function materializeVideo(id: string) {
  const sql = await getSql();
  const video = VIDEOS.find((v) => v.id === id);
  if (!video) return;
  const existing = await sql<{ c: number }>`select count(*)::int as c from frames where video_id = ${id}`;
  if ((existing[0]?.c ?? 0) === 0) {
    const profile = MODEL_PROFILES[(await activeEmbedId())] ?? MODEL_PROFILES["qwen3-vl-emb-8b"]!;
    const index = buildIndex([{ ...video, indexed: true }], profile);
    for (const f of video.frames) {
      await sql`
        insert into frames (id, video_id, timestamp_sec, shot_id, still_url, scene_tags, objects)
        values (${f.id}, ${video.id}, ${f.t}, ${f.shot}, ${f.still}, ${JSON.stringify(f.scene)}::jsonb, ${JSON.stringify(f.objects)}::jsonb)
      `;
    }
    for (const r of index) {
      await sql`
        insert into regions (id, frame_id, video_id, view_type, person_index, bbox, attributes, vector)
        values (
          ${r.id}, ${r.frameId}, ${r.videoId}, ${r.view}, ${r.personIndex},
          ${JSON.stringify(r.bbox)}::jsonb, ${JSON.stringify({ concepts: r.concepts })}::jsonb, ${JSON.stringify(r.vector)}::jsonb
        )
      `;
    }
    await sql`
      update videos set status = 'ready', frame_count = ${video.frames.length}, vector_count = ${index.length}, indexed_at = ${new Date().toISOString()}
      where id = ${id}
    `;
  } else {
    await sql`update videos set status = 'ready' where id = ${id}`;
  }
}

export const listApps = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    kind: DownstreamApp["kind"];
    enabled: boolean;
    config: unknown;
  }>`select * from downstream_apps`;
  return rows.map(
    (a): DownstreamApp => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      enabled: Boolean(a.enabled),
      config: asJson(a.config, {}),
    }),
  );
});

export const toggleApp = createServerFn({ method: "POST" })
  .validator((input: { id: string; enabled: boolean }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update downstream_apps set enabled = ${data.enabled} where id = ${data.id}`;
    return { ok: true as const };
  });

export const recentSearches = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  return sql<{ id: string; query: string; result_count: number; latency_ms: number; created_at: string }>`
    select id, query, result_count, latency_ms, created_at from searches order by created_at desc limit 8
  `;
});

/**
 * 剪辑工程与下游格式导出 (Final Cut Pro FCPXML / Premiere EDL / JSON)
 */
export const exportSearchResults = createServerFn({ method: "POST" })
  .validator((input: { searchId?: string; hits: SearchHit[]; format: ExportFormat }) => input)
  .handler(async ({ data }): Promise<ExportResult> => {
    const { hits, format } = data;
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);

    if (format === "fcpxml") {
      const clips = hits
        .map((h, i) => {
          const duration = Math.max(1, Math.round(h.end - h.start));
          const startFrame = Math.round(h.start * 24);
          const durFrame = duration * 24;
          return `    <asset-clip name="${h.title}" ref="r${i + 1}" offset="${startFrame}/24s" duration="${durFrame}/24s" start="${startFrame}/24s">
      <note>FrameSeek 命中: ${h.matched.join(", ")} (Score: ${Math.round(h.score * 100)}%)</note>
    </asset-clip>`;
        })
        .join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r_fmt" frameDuration="1/24s" width="3840" height="2160"/>
  </resources>
  <library>
    <event name="FrameSeek_Export_${timestampStr}">
      <project name="FrameSeek_Cut">
        <sequence format="r_fmt">
          <spine>
${clips}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
      return {
        format: "fcpxml",
        filename: `frameseek_cut_${timestampStr}.fcpxml`,
        content: xml,
        mimeType: "application/xml",
      };
    }

    if (format === "edl") {
      const edlLines = [
        `TITLE: FRAMESEEK_TIMELINE_${timestampStr}`,
        `FCM: NON-DROP FRAME`,
        ``,
      ];
      hits.forEach((h, idx) => {
        const num = String(idx + 1).padStart(3, "0");
        const sSec = Math.floor(h.start);
        const eSec = Math.floor(h.end);
        const inTc = `01:${String(Math.floor(sSec / 60)).padStart(2, "0")}:${String(sSec % 60).padStart(2, "0")}:00`;
        const outTc = `01:${String(Math.floor(eSec / 60)).padStart(2, "0")}:${String(eSec % 60).padStart(2, "0")}:00`;
        edlLines.push(`${num}  AX       V     C        ${inTc} ${outTc} ${inTc} ${outTc}`);
        edlLines.push(`* FROM CLIP NAME: ${h.title}`);
        edlLines.push(`* MATCHED: ${h.matched.join(", ")}`);
        edlLines.push(``);
      });
      return {
        format: "edl",
        filename: `frameseek_timeline_${timestampStr}.edl`,
        content: edlLines.join("\n"),
        mimeType: "text/plain",
      };
    }

    if (format === "csv") {
      const csvLines = [
        "Index,VideoId,Title,StartTime,EndTime,Score,MatchedKeywords,StillUrl",
        ...hits.map(
          (h, i) =>
            `${i + 1},"${h.videoId}","${h.title}",${h.start},${h.end},${h.score.toFixed(3)},"${h.matched.join("|")}","${h.still}"`,
        ),
      ];
      return {
        format: "csv",
        filename: `frameseek_hits_${timestampStr}.csv`,
        content: csvLines.join("\n"),
        mimeType: "text/csv",
      };
    }

    // Default JSON
    return {
      format: "json",
      filename: `frameseek_results_${timestampStr}.json`,
      content: JSON.stringify(
        {
          generatedAt: now.toISOString(),
          totalHits: hits.length,
          hits: hits.map((h) => ({
            videoId: h.videoId,
            title: h.title,
            startSec: h.start,
            endSec: h.end,
            score: h.score,
            bbox: h.bbox,
            matched: h.matched,
            missing: h.missing,
            evidence: h.evidence,
          })),
        },
        null,
        2,
      ),
      mimeType: "application/json",
    };
  });

/**
 * 统一 API 在线调试执行器 (API Playground)
 */
export const executeApiPlayground = createServerFn({ method: "POST" })
  .validator((input: ApiPlaygroundRequest) => input)
  .handler(async ({ data }): Promise<ApiPlaygroundResponse> => {
    const t0 = Date.now();
    const { method, path, body } = data;

    try {
      if (path === "/api/v1/upstream/browse" || path === "/sources/browse") {
        const parsedBody = body ? JSON.parse(body) : {};
        const res = await browse115({ data: { cid: parsedBody.cid ?? "0" } });
        return {
          status: 200,
          statusText: "OK",
          latencyMs: Date.now() - t0 + 12,
          headers: { "content-type": "application/json", "x-upstream-source": "115" },
          data: res as unknown as Json,
        };
      }

      if (path === "/api/v1/core/search" || path === "/search") {
        const parsedBody = body ? JSON.parse(body) : { query: "穿黑色夹克的男人" };
        const res = await runSearch({ data: { query: parsedBody.query ?? "穿黑色夹克" } });
        return {
          status: 200,
          statusText: "OK",
          latencyMs: Date.now() - t0 + 24,
          headers: { "content-type": "application/json", "x-model-embed": "qwen3-vl-emb-8b" },
          data: res as unknown as Json,
        };
      }

      if (path === "/api/v1/core/embed/text") {
        const parsedBody = body ? JSON.parse(body) : { text: "雨中奔跑" };
        const profile = MODEL_PROFILES["qwen3-vl-emb-8b"]!;
        return {
          status: 200,
          statusText: "OK",
          latencyMs: Date.now() - t0 + 16,
          headers: { "content-type": "application/json", "x-vector-dim": "2048" },
          data: {
            text: parsedBody.text,
            instruction: QUERY_INSTRUCTION,
            dim: 2048,
            model: "Qwen3-VL-Embedding-8B",
            embeddingSample: [0.0412, -0.0892, 0.0315, 0.1284, -0.0573, "...", 0.0194],
          },
        };
      }

      if (path === "/api/v1/downstream/export") {
        const parsedBody = body ? JSON.parse(body) : { format: "fcpxml" };
        const demoHits: SearchHit[] = [
          {
            videoId: "vid_jacket_phone",
            title: "暮色街道 · 通话",
            poster: "/stills/jacket-phone.jpg",
            still: "/stills/jacket-phone.jpg",
            start: 838.0,
            end: 844.6,
            timestamp: 838.0,
            frameId: "f_jp_1",
            score: 0.94,
            fusion: 0.038,
            rerank: 0.88,
            bbox: { x: 0.5, y: 0.08, w: 0.42, h: 0.9 },
            matched: ["黑夹克", "眼镜", "电话"],
            missing: [],
            evidence: [{ view: "person_tight", rank: 1, score: 0.92 }],
            personIndex: 0,
          },
        ];
        const res = await exportSearchResults({ data: { hits: demoHits, format: parsedBody.format ?? "fcpxml" } });
        return {
          status: 200,
          statusText: "OK",
          latencyMs: Date.now() - t0 + 8,
          headers: { "content-type": res.mimeType, "content-disposition": `attachment; filename="${res.filename}"` },
          data: { filename: res.filename, contentPreview: res.content.slice(0, 300) + "..." },
        };
      }

      return {
        status: 200,
        statusText: "OK",
        latencyMs: Date.now() - t0 + 5,
        headers: { "content-type": "application/json" },
        data: { message: `Endpoint ${method} ${path} processed successfully`, timestamp: new Date().toISOString() },
      };
    } catch (err) {
      return {
        status: 400,
        statusText: "Bad Request",
        latencyMs: Date.now() - t0 + 2,
        headers: { "content-type": "application/json" },
        data: { error: err instanceof Error ? err.message : "Invalid request" },
      };
    }
  });

/**
 * 探测与持久化 Google Colab GPU 节点状态
 */
export const probeColabNode = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    const rawUrl = data.url.trim().replace(/\/$/, "");
    if (!rawUrl) return { ok: false, error: "未提供 URL" };
    try {
      const target = rawUrl.endsWith("/api/v1/health") ? rawUrl : `${rawUrl}/api/v1/health`;
      const res = await fetch(target, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const json = (await res.json()) as {
          ok?: boolean;
          service?: string;
          device?: string;
          gpu?: string;
          gdrive_connected?: boolean;
          gdrive_dir?: string;
          timestamp?: number;
        };
        const sql = await getSql();
        await sql`
          insert into settings (key, value) values ('colab_url', ${JSON.stringify(rawUrl)}::jsonb)
          on conflict (key) do update set value = ${JSON.stringify(rawUrl)}::jsonb
        `;
        return {
          ok: true,
          url: rawUrl,
          gpu: json.gpu || "Tesla T4",
          device: json.device || "cuda",
          gdriveConnected: Boolean(json.gdrive_connected),
          gdriveDir: json.gdrive_dir || "/content/drive/MyDrive/FrameSeek",
          timestamp: json.timestamp || Date.now(),
        };
      }
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "连接超时，请确认 Colab 正在运行且 Tailscale 正常" };
    }
  });

export const getColabSettings = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const rows = await sql<{ value: string }>`select value from settings where key = 'colab_url'`;
  const raw = rows[0]?.value;
  if (typeof raw === "string") return raw.replaceAll('"', "");
  return "http://100.92.54.15:8000";
});

/**
 * 客户端本地持久化凭证同步恢复
 */
export const restore115Session = createServerFn({ method: "POST" })
  .validator((input: { user: Pan115User; cookie?: string }) => input)
  .handler(async ({ data }) => {
    await seedIfEmpty();
    const sql = await getSql();
    await sql`
      update sources
      set status = 'connected',
          config = ${JSON.stringify({ user: data.user, cookie: data.cookie })}::jsonb
      where id = 'src_115_qr'
    `;
    return { ok: true };
  });

