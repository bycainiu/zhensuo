import type { Facet } from "./vocab";
import { CONCEPT_BY_ID, labelOf, matchConcepts } from "./vocab";
import {
  cosine,
  embedQueryVariant,
  embedView,
  MODEL_PROFILES,
  viewWeightsFor,
  type ModelProfile,
} from "./embed";
import type { ParsedQuery, SearchHit, SearchTrace, ViewType, ViewWeights } from "@/lib/types";
import type { PersonAnno, VideoAnno } from "@/lib/catalog";

export interface IndexedRegion {
  id: string;
  videoId: string;
  frameId: string;
  view: ViewType;
  personIndex: number | null;
  timestamp: number;
  still: string;
  title: string;
  poster: string;
  bbox: PersonAnno["bbox"] | null;
  concepts: string[];
  vector: number[];
}

const RRF_K = 60;

export function parseLexicon(raw: string): ParsedQuery {
  const hits = matchConcepts(raw);
  const bucket = (facet: Facet) => hits.filter((h) => h.facet === facet).map((h) => h.id);
  const subjectHit = hits.find((h) => h.facet === "subject");
  return {
    raw,
    subject: subjectHit ? labelOf(subjectHit.id) : "",
    action: bucket("action").map(labelOf),
    clothing: bucket("clothing").map(labelOf),
    accessories: bucket("accessory").map(labelOf),
    expression: bucket("expression").map(labelOf),
    scene: bucket("scene").map(labelOf),
    objects: bucket("object").map(labelOf),
    role: bucket("role").map(labelOf),
    concepts: hits.map((h) => h.id),
    source: "lexicon",
  };
}

export function parsedFromGrok(raw: string, data: Partial<ParsedQuery>): ParsedQuery {
  const concepts = new Set<string>(data.concepts ?? []);
  const text = [
    raw,
    data.subject,
    ...(data.action ?? []),
    ...(data.clothing ?? []),
    ...(data.accessories ?? []),
    ...(data.expression ?? []),
    ...(data.scene ?? []),
    ...(data.objects ?? []),
    ...(data.role ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  for (const h of matchConcepts(text)) concepts.add(h.id);
  const lex = parseLexicon([...concepts].join(" ") + " " + raw);
  return {
    ...lex,
    raw,
    subject: data.subject || lex.subject,
    action: data.action?.length ? data.action : lex.action,
    clothing: data.clothing?.length ? data.clothing : lex.clothing,
    accessories: data.accessories?.length ? data.accessories : lex.accessories,
    expression: data.expression?.length ? data.expression : lex.expression,
    scene: data.scene?.length ? data.scene : lex.scene,
    objects: data.objects?.length ? data.objects : lex.objects,
    role: data.role?.length ? data.role : lex.role,
    concepts: [...concepts],
    source: "grok",
  };
}

export function buildIndex(videos: VideoAnno[], profile: ModelProfile): IndexedRegion[] {
  const out: IndexedRegion[] = [];
  for (const video of videos) {
    if (!video.indexed) continue;
    for (const frame of video.frames) {
      const globalConcepts = [
        ...frame.scene.map((id) => ({ id, facet: CONCEPT_BY_ID.get(id)?.facet ?? "scene" })),
        ...frame.objects.map((id) => ({ id, facet: CONCEPT_BY_ID.get(id)?.facet ?? "object" })),
        ...frame.persons.flatMap((p) =>
          p.concepts.map((id) => ({ id, facet: CONCEPT_BY_ID.get(id)?.facet ?? "subject" })),
        ),
      ];
      out.push({
        id: `${frame.id}:global`,
        videoId: video.id,
        frameId: frame.id,
        view: "global",
        personIndex: null,
        timestamp: frame.t,
        still: frame.still,
        title: video.title,
        poster: video.poster,
        bbox: null,
        concepts: [...new Set(globalConcepts.map((c) => c.id))],
        vector: embedView(globalConcepts, "global", profile),
      });
      for (const person of frame.persons) {
        const pc = person.concepts.map((id) => ({
          id,
          facet: CONCEPT_BY_ID.get(id)?.facet ?? "subject",
        }));
        out.push({
          id: `${frame.id}:ctx:${person.index}`,
          videoId: video.id,
          frameId: frame.id,
          view: "person_context",
          personIndex: person.index,
          timestamp: frame.t,
          still: frame.still,
          title: video.title,
          poster: video.poster,
          bbox: expand(person.bbox, 1.35),
          concepts: person.concepts,
          vector: embedView(pc, "person_context", profile),
        });
        out.push({
          id: `${frame.id}:tight:${person.index}`,
          videoId: video.id,
          frameId: frame.id,
          view: "person_tight",
          personIndex: person.index,
          timestamp: frame.t,
          still: frame.still,
          title: video.title,
          poster: video.poster,
          bbox: person.bbox,
          concepts: person.concepts,
          vector: embedView(pc, "person_tight", profile),
        });
        if (person.facePx >= 80 && person.faceBbox) {
          out.push({
            id: `${frame.id}:face:${person.index}`,
            videoId: video.id,
            frameId: frame.id,
            view: "face",
            personIndex: person.index,
            timestamp: frame.t,
            still: frame.still,
            title: video.title,
            poster: video.poster,
            bbox: person.faceBbox,
            concepts: person.concepts,
            vector: embedView(pc, "face", profile),
          });
        }
      }
    }
  }
  return out;
}

function expand(b: PersonAnno["bbox"], f: number): PersonAnno["bbox"] {
  const w = Math.min(1, b.w * f);
  const h = Math.min(1, b.h * f);
  return {
    x: Math.max(0, b.x - (w - b.w) / 2),
    y: Math.max(0, b.y - (h - b.h) / 2),
    w,
    h,
  };
}

function facetsOf(parsed: ParsedQuery): Facet[] {
  const out: Facet[] = [];
  if (parsed.action.length) out.push("action");
  if (parsed.clothing.length) out.push("clothing");
  if (parsed.accessories.length) out.push("accessory");
  if (parsed.expression.length) out.push("expression");
  if (parsed.scene.length) out.push("scene");
  if (parsed.objects.length) out.push("object");
  if (parsed.role.length) out.push("role");
  if (parsed.subject) out.push("subject");
  return out;
}

function queryVariants(parsed: ParsedQuery): { id: string; text: string; view: ViewType; ids: string[] }[] {
  const byFacet = (facet: Facet) =>
    parsed.concepts.filter((id) => CONCEPT_BY_ID.get(id)?.facet === facet);
  const all = parsed.concepts;
  const variants: { id: string; text: string; view: ViewType; ids: string[] }[] = [
    { id: "Q0", text: parsed.raw, view: "global", ids: all },
    { id: "Q1", text: parsed.action.join("、") || parsed.raw, view: "person_context", ids: [...byFacet("action"), ...byFacet("object"), ...byFacet("subject")] },
    { id: "Q2", text: [...parsed.clothing, ...parsed.accessories].join("、") || parsed.raw, view: "person_tight", ids: [...byFacet("clothing"), ...byFacet("accessory"), ...byFacet("role"), ...byFacet("subject")] },
    { id: "Q3", text: parsed.expression.join("、") || parsed.raw, view: "face", ids: [...byFacet("expression"), ...byFacet("subject")] },
  ];
  return variants.map((v) => ({ ...v, ids: v.ids.length ? v.ids : all }));
}

export function retrieve(
  parsed: ParsedQuery,
  index: IndexedRegion[],
  modelId: string,
  opts?: { rerank: boolean },
): { hits: SearchHit[]; trace: SearchTrace } {
  const t0 = Date.now();
  const profile = MODEL_PROFILES[modelId] ?? MODEL_PROFILES["qwen3-vl-emb-8b"]!;
  const chinese = /[\u4e00-\u9fff]/.test(parsed.raw);
  const weights = viewWeightsFor(facetsOf(parsed)) as ViewWeights;
  const variants = queryVariants(parsed);
  const wanted = new Set(parsed.concepts);

  const ranks: { region: IndexedRegion; rank: number; score: number; view: ViewType }[] = [];

  for (const variant of variants) {
    const qv = embedQueryVariant(variant.ids, variant.view, profile, chinese);
    const pool = index.filter((r) => r.view === variant.view);
    const scored = pool
      .map((r) => ({ r, s: cosine(qv, r.vector) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 120);
    scored.forEach((row, i) => {
      ranks.push({ region: row.r, rank: i + 1, score: row.s, view: variant.view });
    });
  }

  const fused = new Map<
    string,
    { frameId: string; rrf: number; best: IndexedRegion; evidence: SearchHit["evidence"]; maxScore: number }
  >();

  for (const row of ranks) {
    const key = row.region.frameId;
    const w = weights[row.view];
    const add = w / (RRF_K + row.rank);
    const cur = fused.get(key);
    const ev = { view: row.view, rank: row.rank, score: row.score };
    if (!cur) {
      fused.set(key, {
        frameId: key,
        rrf: add,
        best: row.region,
        evidence: [ev],
        maxScore: row.score,
      });
    } else {
      cur.rrf += add;
      cur.evidence.push(ev);
      if (row.score > cur.maxScore) {
        cur.maxScore = row.score;
        cur.best = row.region;
      }
    }
  }

  let ranked = [...fused.values()].sort((a, b) => b.rrf - a.rrf);

  if (opts?.rerank !== false) {
    ranked = ranked
      .map((row) => {
        const overlap = row.best.concepts.filter((c) => wanted.has(c)).length;
        const precision = overlap / Math.max(1, wanted.size);
        const bonus = precision * 0.28 * profile.compound;
        return { ...row, rrf: row.rrf + bonus };
      })
      .sort((a, b) => b.rrf - a.rrf);
  }

  const specificWanted = [...wanted].filter((id) => {
    const facet = CONCEPT_BY_ID.get(id)?.facet;
    return facet && facet !== "subject";
  });

  const byVideo = new Map<string, typeof ranked>();
  for (const row of ranked) {
    const list = byVideo.get(row.best.videoId) ?? [];
    list.push(row);
    byVideo.set(row.best.videoId, list);
  }

  const clustered = [...byVideo.values()]
    .map((rows) => {
      const ordered = rows.slice().sort((a, b) => b.rrf - a.rrf);
      const best = ordered[0]!;
      const cluster = ordered.filter((x) => Math.abs(x.best.timestamp - best.best.timestamp) <= 4);
      return { best, cluster };
    })
    .sort((a, b) => b.best.rrf - a.best.rrf);

  const hits: SearchHit[] = [];
  for (const { best, cluster } of clustered) {
    const r = best.best;
    const matchedIds = r.concepts.filter((c) => wanted.has(c));
    if (matchedIds.length === 0) continue;
    const specificHit = specificWanted.filter((id) => r.concepts.includes(id));
    if (specificWanted.length >= 3 && specificHit.length < 2) continue;
    if (specificWanted.length >= 2 && specificHit.length === 0) continue;
    const precision = matchedIds.length / Math.max(1, wanted.size);
    const score = Math.min(0.99, Math.max(0.08, 0.22 + 0.52 * precision + 0.26 * best.maxScore));
    if (score < 0.42 && specificHit.length < 2) continue;
    const start = Math.min(...cluster.map((n) => n.best.timestamp));
    const end = Math.max(...cluster.map((n) => n.best.timestamp));
    hits.push({
      videoId: r.videoId,
      title: r.title,
      poster: r.poster,
      still: r.still,
      start,
      end: end === start ? start + 1.6 : end,
      timestamp: r.timestamp,
      frameId: r.frameId,
      score,
      fusion: best.rrf,
      rerank: best.maxScore,
      bbox: r.bbox,
      matched: matchedIds.map(labelOf),
      missing: [...wanted].filter((c) => !r.concepts.includes(c)).map(labelOf),
      evidence: best.evidence.sort((a, b) => a.rank - b.rank).slice(0, 4),
      personIndex: r.personIndex,
    });
    if (hits.length >= 6) break;
  }

  const trace: SearchTrace = {
    query: parsed,
    weights,
    variants: variants.map((v) => ({ id: v.id, text: v.text, view: v.view })),
    modelId: profile.id,
    dim: 2048,
    latencyMs: Date.now() - t0 + 18,
    candidateCount: fused.size,
    reranked: opts?.rerank !== false,
  };

  return { hits, trace };
}

export function indexStats(index: IndexedRegion[]) {
  const byView: Record<string, number> = {};
  for (const r of index) byView[r.view] = (byView[r.view] ?? 0) + 1;
  return { total: index.length, byView };
}
