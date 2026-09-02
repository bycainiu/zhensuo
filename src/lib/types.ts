export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: any }
  | any[];

export type ViewType = "global" | "person_context" | "person_tight" | "face";

export type SourceKind = "115_qr" | "115_cookie" | "115_open" | "115_demo" | "115_share" | "upload";

export type Pan115AppType = "ios" | "ipad" | "mac" | "web";

export type Pan115AuthMode = "qr" | "cookie" | "open" | "sandbox";

export interface Pan115QrSession {
  uid: string;
  time: number;
  sign: string;
  qrcode: string;
  app: Pan115AppType;
  expiresAt: number;
}

export interface Pan115QrStatus {
  status: 0 | 1 | 2 | -1 | -2; // 0: 等待扫码, 1: 已扫码待确认, 2: 登录成功, -1/-2: 已失效/取消
  msg: string;
  version?: string;
  cookie?: string;
  user?: Pan115User;
}

export interface Pan115User {
  userId: string;
  userName: string;
  avatarUrl: string;
  isVip: boolean;
  vipLevel?: string;
  spaceTotalGb: number;
  spaceUsedGb: number;
  device: string;
  authMode: Pan115AuthMode;
  connectedAt: string;
}

export type VideoStatus = "pending" | "indexing" | "ready" | "error";

export type JobStage =
  | "queued"
  | "decode"
  | "shot"
  | "sample"
  | "detect"
  | "embed"
  | "index"
  | "done"
  | "error";

export type ModelRole = "embedding" | "reranker";

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParsedQuery {
  raw: string;
  subject: string;
  action: string[];
  clothing: string[];
  accessories: string[];
  expression: string[];
  scene: string[];
  objects: string[];
  role: string[];
  concepts: string[];
  source: "grok" | "lexicon";
}

export interface ViewWeights {
  global: number;
  person_context: number;
  person_tight: number;
  face: number;
}

export interface HitEvidence {
  view: ViewType;
  rank: number;
  score: number;
  detail?: string;
}

export interface SearchHit {
  videoId: string;
  title: string;
  poster: string;
  still: string;
  start: number;
  end: number;
  timestamp: number;
  frameId: string;
  score: number;
  fusion: number;
  rerank: number;
  bbox: BBox | null;
  faceBbox?: BBox | null;
  matched: string[];
  missing: string[];
  evidence: HitEvidence[];
  personIndex: number | null;
  scene?: string[];
}

export interface SearchTrace {
  query: ParsedQuery;
  weights: ViewWeights;
  variants: { id: string; text: string; view: ViewType }[];
  modelId: string;
  dim: number;
  latencyMs: number;
  candidateCount: number;
  reranked: boolean;
}

export interface VideoCard {
  id: string;
  title: string;
  filename: string;
  duration: number;
  poster: string;
  status: VideoStatus;
  path: string;
  sourceId: string;
  frameCount: number;
  vectorCount: number;
  sizeMb: number;
  tags?: string[];
}

export interface FrameCard {
  id: string;
  videoId: string;
  timestamp: number;
  still: string;
  scene: string[];
  persons: number;
  objects?: string[];
}

export interface RegionCard {
  id: string;
  frameId: string;
  viewType: ViewType;
  bbox: BBox | null;
  attributes: Record<string, any>;
}

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  name: string;
  status: "connected" | "disconnected" | "error" | "paused";
  config: Record<string, any>;
  user?: Pan115User | null;
}

export interface PanFile {
  fid: string;
  pid: string;
  name: string;
  isDir: boolean;
  sizeMb: number;
  duration: number | null;
  pickCode: string;
  ico: string;
  path: string;
  indexed: boolean;
  videoId: string | null;
  still: string | null;
  updateTime?: string;
}

export interface IngestJob {
  id: string;
  videoId: string | null;
  sourceId: string;
  filename: string;
  stage: JobStage;
  progress: number;
  log: { t: number; msg: string }[];
  createdAt: string;
  speedFps?: number;
  vectorCount?: number;
}

export interface ModelCard {
  id: string;
  role: ModelRole;
  name: string;
  vendor: string;
  dim: number | null;
  languages: string[];
  vramGb: number;
  notes: string;
  active: boolean;
  chinese: "strong" | "multi" | "weak";
  action: number;
  expression: number;
  clothing: number;
  compound: number;
}

export interface DownstreamApp {
  id: string;
  name: string;
  kind: "webhook" | "rag" | "export" | "api";
  enabled: boolean;
  config: Record<string, any>;
  description?: string;
}

export interface OverviewStats {
  videos: number;
  frames: number;
  vectors: number;
  ready: number;
  pending: number;
  searches: number;
  activeEmbed: string;
  activeRerank: string;
  sourceStatus: string;
  connected115User?: string | null;
}

export type ExportFormat = "fcpxml" | "edl" | "json" | "csv";

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  content: string;
  mimeType: string;
}

export interface ApiPlaygroundRequest {
  method: "GET" | "POST";
  path: string;
  body?: string;
}

export interface ApiPlaygroundResponse {
  status: number;
  statusText: string;
  latencyMs: number;
  headers: Record<string, string>;
  data: any;
}
