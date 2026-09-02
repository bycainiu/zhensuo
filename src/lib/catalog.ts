import type { BBox } from "./types";

export interface PersonAnno {
  index: number;
  bbox: BBox;
  faceBbox?: BBox;
  facePx: number;
  concepts: string[];
}

export interface FrameAnno {
  id: string;
  t: number;
  shot: number;
  still: string;
  scene: string[];
  objects: string[];
  persons: PersonAnno[];
}

export interface VideoAnno {
  id: string;
  title: string;
  filename: string;
  duration: number;
  w: number;
  h: number;
  poster: string;
  path: string;
  pickCode: string;
  sizeMb: number;
  indexed: boolean;
  description: string;
  frames: FrameAnno[];
}

const manPhone: PersonAnno = {
  index: 0,
  bbox: { x: 0.5, y: 0.08, w: 0.42, h: 0.9 },
  faceBbox: { x: 0.62, y: 0.1, w: 0.16, h: 0.28 },
  facePx: 140,
  concepts: ["man", "black_jacket", "glasses", "phone_call", "holding_phone", "smiling", "phone"],
};

export const VIDEOS: VideoAnno[] = [
  {
    id: "vid_jacket_phone",
    title: "暮色街道 · 通话",
    filename: "黑夹克通话_4K.mp4",
    duration: 1124,
    w: 3840,
    h: 2160,
    poster: "/stills/jacket-phone.jpg",
    path: "/影视素材/城市街道/黑夹克通话_4K.mp4",
    pickCode: "pck7a2m91k",
    sizeMb: 1840,
    indexed: true,
    description: "城市暮色，戴眼镜的黑夹克男性用手持手机通话并微笑。",
    frames: [
      {
        id: "f_jp_1",
        t: 838.0,
        shot: 14,
        still: "/stills/jacket-phone.jpg",
        scene: ["street"],
        objects: ["phone"],
        persons: [
          {
            index: 0,
            bbox: { x: 0.5, y: 0.08, w: 0.42, h: 0.9 },
            faceBbox: { x: 0.62, y: 0.1, w: 0.16, h: 0.28 },
            facePx: 140,
            concepts: ["man", "black_jacket", "glasses", "neutral", "phone"],
          },
        ],
      },
      {
        id: "f_jp_2",
        t: 843.25,
        shot: 14,
        still: "/stills/jacket-phone.jpg",
        scene: ["street"],
        objects: ["phone"],
        persons: [manPhone],
      },
      {
        id: "f_jp_3",
        t: 844.6,
        shot: 14,
        still: "/stills/jacket-phone.jpg",
        scene: ["street"],
        objects: ["phone"],
        persons: [manPhone],
      },
      {
        id: "f_jp_4",
        t: 851.2,
        shot: 15,
        still: "/stills/jacket-phone.jpg",
        scene: ["street"],
        objects: ["phone"],
        persons: [
          {
            index: 0,
            bbox: { x: 0.5, y: 0.08, w: 0.42, h: 0.9 },
            faceBbox: { x: 0.62, y: 0.1, w: 0.16, h: 0.28 },
            facePx: 140,
            concepts: ["man", "black_jacket", "glasses", "neutral", "holding_phone"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_red_dress",
    title: "广场 · 红裙",
    filename: "红裙广场_4K.mp4",
    duration: 486,
    w: 3840,
    h: 2160,
    poster: "/stills/red-dress.jpg",
    path: "/影视素材/城市街道/红裙广场_4K.mp4",
    pickCode: "pckb81q0e3",
    sizeMb: 920,
    indexed: true,
    description: "阳光广场，穿红色连衣裙的女性走过。",
    frames: [
      {
        id: "f_rd_1",
        t: 62.4,
        shot: 3,
        still: "/stills/red-dress.jpg",
        scene: ["plaza"],
        objects: [],
        persons: [
          {
            index: 0,
            bbox: { x: 0.38, y: 0.12, w: 0.28, h: 0.82 },
            faceBbox: { x: 0.46, y: 0.12, w: 0.1, h: 0.16 },
            facePx: 96,
            concepts: ["woman", "red_dress", "walking", "neutral"],
          },
        ],
      },
      {
        id: "f_rd_2",
        t: 71.1,
        shot: 3,
        still: "/stills/red-dress.jpg",
        scene: ["plaza"],
        objects: [],
        persons: [
          {
            index: 0,
            bbox: { x: 0.36, y: 0.1, w: 0.3, h: 0.86 },
            faceBbox: { x: 0.45, y: 0.1, w: 0.1, h: 0.16 },
            facePx: 102,
            concepts: ["woman", "red_dress", "walking", "smiling"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_rain_run",
    title: "雨夜 · 奔跑",
    filename: "雨夜奔跑_4K.mp4",
    duration: 214,
    w: 3840,
    h: 2160,
    poster: "/stills/rain-run.jpg",
    path: "/影视素材/城市街道/雨夜奔跑_4K.mp4",
    pickCode: "pckd44n7s2",
    sizeMb: 640,
    indexed: true,
    description: "雨夜城市街道，一名女性在湿路面上奔跑。",
    frames: [
      {
        id: "f_rr_1",
        t: 38.2,
        shot: 2,
        still: "/stills/rain-run.jpg",
        scene: ["street", "rain"],
        objects: [],
        persons: [
          {
            index: 0,
            bbox: { x: 0.22, y: 0.18, w: 0.28, h: 0.7 },
            facePx: 42,
            concepts: ["woman", "dark_coat", "running"],
          },
        ],
      },
      {
        id: "f_rr_2",
        t: 41.8,
        shot: 2,
        still: "/stills/rain-run.jpg",
        scene: ["street", "rain"],
        objects: [],
        persons: [
          {
            index: 0,
            bbox: { x: 0.28, y: 0.16, w: 0.3, h: 0.74 },
            facePx: 48,
            concepts: ["woman", "dark_coat", "running"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_basketball",
    title: "室内球场 · 扣篮",
    filename: "室内扣篮_4K.mp4",
    duration: 96,
    w: 3840,
    h: 2160,
    poster: "/stills/basketball.jpg",
    path: "/影视素材/体育与时尚/室内扣篮_4K.mp4",
    pickCode: "pckf09t2a8",
    sizeMb: 410,
    indexed: true,
    description: "室内篮球场，红球衣球员完成扣篮。",
    frames: [
      {
        id: "f_bb_1",
        t: 12.4,
        shot: 1,
        still: "/stills/basketball.jpg",
        scene: ["court"],
        objects: ["ball"],
        persons: [
          {
            index: 0,
            bbox: { x: 0.32, y: 0.08, w: 0.36, h: 0.7 },
            facePx: 64,
            concepts: ["man", "athlete", "red_jersey", "playing_basketball", "dunking", "ball"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_chef",
    title: "餐厅后厨",
    filename: "餐厅后厨_4K.mp4",
    duration: 754,
    w: 3840,
    h: 2160,
    poster: "/stills/chef.jpg",
    path: "/影视素材/室内场景/餐厅后厨_4K.mp4",
    pickCode: "pckh55c1w0",
    sizeMb: 1280,
    indexed: true,
    description: "专业厨房，穿厨师服的人在炉灶前烹饪。",
    frames: [
      {
        id: "f_ch_1",
        t: 204.5,
        shot: 8,
        still: "/stills/chef.jpg",
        scene: ["kitchen"],
        objects: ["pan"],
        persons: [
          {
            index: 0,
            bbox: { x: 0.28, y: 0.1, w: 0.4, h: 0.85 },
            faceBbox: { x: 0.4, y: 0.12, w: 0.12, h: 0.2 },
            facePx: 110,
            concepts: ["man", "chef", "chef_coat", "toque", "cooking", "focused", "pan"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_office",
    title: "开放办公",
    filename: "开放办公_4K.mp4",
    duration: 1680,
    w: 3840,
    h: 2160,
    poster: "/stills/office.jpg",
    path: "/影视素材/室内场景/开放办公_4K.mp4",
    pickCode: "pckj17p4d6",
    sizeMb: 2100,
    indexed: true,
    description: "开放办公室，蓝衬衫男性坐在电脑前。",
    frames: [
      {
        id: "f_of_1",
        t: 412.0,
        shot: 11,
        still: "/stills/office.jpg",
        scene: ["office"],
        objects: ["computer", "desk"],
        persons: [
          {
            index: 0,
            bbox: { x: 0.34, y: 0.22, w: 0.28, h: 0.7 },
            facePx: 70,
            concepts: ["man", "blue_shirt", "typing", "computer", "neutral"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_studio",
    title: "演播室访谈",
    filename: "演播室访谈_4K.mp4",
    duration: 2620,
    w: 3840,
    h: 2160,
    poster: "/stills/studio.jpg",
    path: "/影视素材/室内场景/演播室访谈_4K.mp4",
    pickCode: "pckm88v3b1",
    sizeMb: 3400,
    indexed: false,
    description: "电视演播室，主持人采访两名嘉宾。",
    frames: [
      {
        id: "f_st_1",
        t: 188.4,
        shot: 4,
        still: "/stills/studio.jpg",
        scene: ["studio"],
        objects: ["desk"],
        persons: [
          {
            index: 0,
            bbox: { x: 0.18, y: 0.28, w: 0.22, h: 0.6 },
            facePx: 80,
            concepts: ["man", "host", "dark_suit", "interviewing", "neutral"],
          },
          {
            index: 1,
            bbox: { x: 0.42, y: 0.3, w: 0.2, h: 0.55 },
            facePx: 72,
            concepts: ["man", "dark_suit", "neutral"],
          },
          {
            index: 2,
            bbox: { x: 0.62, y: 0.3, w: 0.2, h: 0.55 },
            facePx: 70,
            concepts: ["woman", "dark_suit", "neutral"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_downjacket",
    title: "黑色羽绒服 Lookbook",
    filename: "黑色羽绒服Lookbook.mp4",
    duration: 148,
    w: 3840,
    h: 2160,
    poster: "/stills/downjacket.jpg",
    path: "/影视素材/体育与时尚/黑色羽绒服Lookbook.mp4",
    pickCode: "pckn21s9q4",
    sizeMb: 380,
    indexed: false,
    description: "展厅内模特穿着长款黑色羽绒服。",
    frames: [
      {
        id: "f_dj_1",
        t: 22.0,
        shot: 1,
        still: "/stills/downjacket.jpg",
        scene: ["showroom"],
        objects: [],
        persons: [
          {
            index: 0,
            bbox: { x: 0.38, y: 0.08, w: 0.28, h: 0.88 },
            faceBbox: { x: 0.46, y: 0.08, w: 0.1, h: 0.16 },
            facePx: 100,
            concepts: ["woman", "model", "down_jacket", "neutral", "walking"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_doctor",
    title: "医院走廊",
    filename: "医院走廊_医生.mp4",
    duration: 540,
    w: 3840,
    h: 2160,
    poster: "/stills/doctor.jpg",
    path: "/工业与职业/医院走廊_医生.mp4",
    pickCode: "pckp60e2u7",
    sizeMb: 870,
    indexed: false,
    description: "医院走廊，穿白大褂、戴听诊器的医生。",
    frames: [
      {
        id: "f_dc_1",
        t: 96.3,
        shot: 3,
        still: "/stills/doctor.jpg",
        scene: ["hospital"],
        objects: [],
        persons: [
          {
            index: 0,
            bbox: { x: 0.32, y: 0.1, w: 0.36, h: 0.86 },
            faceBbox: { x: 0.42, y: 0.1, w: 0.12, h: 0.18 },
            facePx: 120,
            concepts: ["man", "doctor", "white_coat", "stethoscope", "neutral", "walking"],
          },
        ],
      },
    ],
  },
  {
    id: "vid_forklift",
    title: "仓储叉车作业",
    filename: "仓储叉车作业.mp4",
    duration: 318,
    w: 3840,
    h: 2160,
    poster: "/stills/forklift.jpg",
    path: "/工业与职业/仓储叉车作业.mp4",
    pickCode: "pckr14k8z5",
    sizeMb: 760,
    indexed: false,
    description: "仓库内工人穿安全背心、戴安全帽操作叉车。",
    frames: [
      {
        id: "f_fk_1",
        t: 54.7,
        shot: 2,
        still: "/stills/forklift.jpg",
        scene: ["warehouse"],
        objects: ["forklift"],
        persons: [
          {
            index: 0,
            bbox: { x: 0.4, y: 0.18, w: 0.28, h: 0.7 },
            facePx: 56,
            concepts: ["man", "worker", "safety_vest", "helmet", "operating_forklift", "forklift", "focused"],
          },
        ],
      },
    ],
  },
];

export const PAN_FOLDERS: { cid: string; pid: string; name: string; path: string }[] = [
  { cid: "0", pid: "", name: "根目录", path: "/" },
  { cid: "cid_media", pid: "0", name: "影视素材", path: "/影视素材" },
  { cid: "cid_street", pid: "cid_media", name: "城市街道", path: "/影视素材/城市街道" },
  { cid: "cid_indoor", pid: "cid_media", name: "室内场景", path: "/影视素材/室内场景" },
  { cid: "cid_sport", pid: "cid_media", name: "体育与时尚", path: "/影视素材/体育与时尚" },
  { cid: "cid_work", pid: "0", name: "工业与职业", path: "/工业与职业" },
];

export function folderChildren(cid: string) {
  return PAN_FOLDERS.filter((f) => f.pid === cid);
}

export function filesInFolder(cid: string) {
  const folder = PAN_FOLDERS.find((f) => f.cid === cid);
  if (!folder) return [];
  const prefix = folder.path === "/" ? "" : folder.path;
  return VIDEOS.filter((v) => {
    const dir = v.path.slice(0, v.path.lastIndexOf("/")) || "/";
    return dir === prefix || (prefix === "" && v.path.split("/").length === 2);
  });
}
