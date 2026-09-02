import type { ViewType } from "@/lib/types";
import { CONCEPT_BY_ID, type Facet } from "./vocab";

export const EMBED_DIM = 96;
export const DISPLAY_DIM = 2048;

export const QUERY_INSTRUCTION =
  "Retrieve images that visually match the user's description, with particular attention to visible human actions, body poses, facial expressions, clothing types, colors, accessories, objects, and scene context.";

export interface ModelProfile {
  id: string;
  action: number;
  expression: number;
  clothing: number;
  compound: number;
  chinese: number;
}

export const MODEL_PROFILES: Record<string, ModelProfile> = {
  "qwen3-vl-emb-8b": { id: "qwen3-vl-emb-8b", action: 1, expression: 0.96, clothing: 1, compound: 1, chinese: 1 },
  "qwen3-vl-emb-2b": { id: "qwen3-vl-emb-2b", action: 0.9, expression: 0.86, clothing: 0.94, compound: 0.88, chinese: 0.98 },
  "jina-clip-v2": { id: "jina-clip-v2", action: 0.78, expression: 0.55, clothing: 0.9, compound: 0.7, chinese: 0.92 },
  "chinese-clip-l14": { id: "chinese-clip-l14", action: 0.7, expression: 0.48, clothing: 0.88, compound: 0.62, chinese: 1 },
  "siglip2-large": { id: "siglip2-large", action: 0.82, expression: 0.6, clothing: 0.92, compound: 0.74, chinese: 0.8 },
};

function facetGain(facet: Facet, profile: ModelProfile): number {
  switch (facet) {
    case "action":
    case "object":
      return profile.action;
    case "expression":
      return profile.expression;
    case "clothing":
    case "accessory":
    case "role":
      return profile.clothing;
    default:
      return profile.compound;
  }
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const conceptCache = new Map<string, Float64Array>();

export function conceptVector(id: string, dim = EMBED_DIM): Float64Array {
  const key = `${id}:${dim}`;
  const hit = conceptCache.get(key);
  if (hit) return hit;
  const rng = mulberry32(hash32(`frameseek:${id}`));
  const v = new Float64Array(dim);
  for (let i = 0; i < dim; i++) v[i] = gaussian(rng);
  l2(v);
  conceptCache.set(key, v);
  return v;
}

export function l2(v: Float64Array) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / ((Math.sqrt(na) || 1) * (Math.sqrt(nb) || 1));
}

export interface WeightedConcept {
  id: string;
  weight: number;
}

const VIEW_PRIOR: Record<ViewType, Partial<Record<Facet, number>>> = {
  global: { scene: 0.42, action: 0.22, object: 0.18, role: 0.1, subject: 0.08 },
  person_context: { action: 0.42, object: 0.22, clothing: 0.14, subject: 0.12, accessory: 0.1 },
  person_tight: { clothing: 0.46, accessory: 0.22, subject: 0.14, role: 0.1, action: 0.08 },
  face: { expression: 0.72, subject: 0.28 },
};

export function mixConcepts(
  items: WeightedConcept[],
  profile: ModelProfile,
  dim = EMBED_DIM,
): number[] {
  const acc = new Float64Array(dim);
  for (const item of items) {
    const concept = CONCEPT_BY_ID.get(item.id);
    if (!concept) continue;
    const vec = conceptVector(item.id, dim);
    const w = item.weight * facetGain(concept.facet, profile);
    for (let i = 0; i < dim; i++) acc[i] += vec[i] * w;
  }
  l2(acc);
  return Array.from(acc);
}

export function embedView(
  concepts: { id: string; facet: Facet }[],
  view: ViewType,
  profile: ModelProfile,
): number[] {
  const prior = VIEW_PRIOR[view];
  const weighted: WeightedConcept[] = concepts.map((c) => ({
    id: c.id,
    weight: prior[c.facet] ?? 0.06,
  }));
  if (weighted.length === 0) return mixConcepts([{ id: "person", weight: 1 }], profile);
  return mixConcepts(weighted, profile);
}

export function embedQueryVariant(
  conceptIds: string[],
  view: ViewType,
  profile: ModelProfile,
  chineseQuery: boolean,
): number[] {
  const items = conceptIds
    .map((id) => CONCEPT_BY_ID.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      weight: (VIEW_PRIOR[view][c.facet] ?? 0.08) * (chineseQuery ? profile.chinese : 1),
    }));
  return mixConcepts(items.length ? items : [{ id: "person", weight: 1 }], profile);
}

export function viewWeightsFor(facets: Facet[]): Record<ViewType, number> {
  const has = (f: Facet) => facets.includes(f);
  if (has("expression") && !has("action") && !has("clothing")) {
    return { global: 0.1, person_context: 0.15, person_tight: 0.2, face: 0.55 };
  }
  if (has("clothing") && !has("action") && !has("expression")) {
    return { global: 0.15, person_context: 0.25, person_tight: 0.55, face: 0.05 };
  }
  if (has("action") && !has("clothing") && !has("expression")) {
    return { global: 0.3, person_context: 0.5, person_tight: 0.15, face: 0.05 };
  }
  if (has("scene") && !has("action") && !has("clothing")) {
    return { global: 0.7, person_context: 0.15, person_tight: 0.1, face: 0.05 };
  }
  return { global: 0.22, person_context: 0.34, person_tight: 0.26, face: 0.18 };
}
