export type Facet =
  | "subject"
  | "action"
  | "clothing"
  | "accessory"
  | "expression"
  | "scene"
  | "object"
  | "role";

export interface Concept {
  id: string;
  facet: Facet;
  aliases: string[];
}

export const CONCEPTS: Concept[] = [
  { id: "man", facet: "subject", aliases: ["男人", "男性", "男", "小伙子", "男士", "man", "male"] },
  { id: "woman", facet: "subject", aliases: ["女人", "女性", "女", "女士", "woman", "female"] },
  { id: "person", facet: "subject", aliases: ["人", "有人", "人物", "person"] },

  { id: "phone_call", facet: "action", aliases: ["打电话", "通话", "讲电话", "打电话的", "手机贴耳", "calling", "on the phone"] },
  { id: "running", facet: "action", aliases: ["奔跑", "跑步", "跑", "running"] },
  { id: "dunking", facet: "action", aliases: ["扣篮", "灌篮", "dunk"] },
  { id: "cooking", facet: "action", aliases: ["做饭", "烹饪", "炒菜", "做煎饼", "cooking"] },
  { id: "riding_bike", facet: "action", aliases: ["骑车", "骑自行车", "骑行", "bicycle"] },
  { id: "interviewing", facet: "action", aliases: ["采访", "访谈", "主持", "interview"] },
  { id: "operating_forklift", facet: "action", aliases: ["开叉车", "操作叉车", "叉车", "forklift"] },
  { id: "typing", facet: "action", aliases: ["打字", "用电脑", "坐在电脑前", "typing"] },
  { id: "walking", facet: "action", aliases: ["走路", "行走", "走过", "walking"] },
  { id: "holding_phone", facet: "action", aliases: ["拿着手机", "手持手机", "holding a phone"] },
  { id: "playing_basketball", facet: "action", aliases: ["打篮球", "运球", "投篮", "basketball"] },

  { id: "black_jacket", facet: "clothing", aliases: ["黑色夹克", "黑夹克", "黑色皮衣", "皮夹克", "黑色外套", "black jacket", "leather jacket"] },
  { id: "black_hoodie", facet: "clothing", aliases: ["黑色连帽衫", "黑色卫衣", "连帽衫", "hoodie"] },
  { id: "blue_shirt", facet: "clothing", aliases: ["蓝色衬衫", "蓝衬衫", "蓝色衬衣", "blue shirt"] },
  { id: "red_dress", facet: "clothing", aliases: ["红色连衣裙", "红裙", "红色长裙", "red dress"] },
  { id: "white_coat", facet: "clothing", aliases: ["白大褂", "白袍", "白色外套", "white coat"] },
  { id: "chef_coat", facet: "clothing", aliases: ["厨师服", "厨衣", "白色厨衣", "chef"] },
  { id: "down_jacket", facet: "clothing", aliases: ["羽绒服", "长款羽绒服", "黑色羽绒服", "down jacket"] },
  { id: "dark_suit", facet: "clothing", aliases: ["西装", "黑色西装", "深色西装", "suit"] },
  { id: "red_jersey", facet: "clothing", aliases: ["红色球衣", "红球衣", "球衣", "jersey"] },
  { id: "safety_vest", facet: "clothing", aliases: ["安全背心", "反光背心", "橙色背心", "vest"] },
  { id: "dark_coat", facet: "clothing", aliases: ["深色大衣", "黑色大衣", "外套", "coat"] },

  { id: "glasses", facet: "accessory", aliases: ["眼镜", "戴眼镜", "眼镜", "glasses"] },
  { id: "helmet", facet: "accessory", aliases: ["安全帽", "黄帽", "头盔", "helmet"] },
  { id: "stethoscope", facet: "accessory", aliases: ["听诊器", "stethoscope"] },
  { id: "toque", facet: "accessory", aliases: ["厨师帽", "toque"] },
  { id: "umbrella", facet: "accessory", aliases: ["伞", "雨伞", "umbrella"] },

  { id: "smiling", facet: "expression", aliases: ["微笑", "笑着", "面带微笑", "在笑", "smiling", "smile"] },
  { id: "laughing", facet: "expression", aliases: ["大笑", "laughing"] },
  { id: "crying", facet: "expression", aliases: ["哭", "哭泣", "crying"] },
  { id: "angry", facet: "expression", aliases: ["生气", "愤怒", "angry"] },
  { id: "neutral", facet: "expression", aliases: ["平静", "面无表情", "neutral"] },
  { id: "surprised", facet: "expression", aliases: ["惊讶", "surprised"] },
  { id: "focused", facet: "expression", aliases: ["专注", "认真", "focused"] },

  { id: "street", facet: "scene", aliases: ["街道", "路边", "城市街道", "street"] },
  { id: "rain", facet: "scene", aliases: ["雨中", "下雨", "雨夜", "rain"] },
  { id: "office", facet: "scene", aliases: ["办公室", "办公", "office"] },
  { id: "kitchen", facet: "scene", aliases: ["厨房", "后厨", "kitchen"] },
  { id: "court", facet: "scene", aliases: ["球场", "篮球场", "court"] },
  { id: "studio", facet: "scene", aliases: ["演播室", "摄影棚", "studio"] },
  { id: "hospital", facet: "scene", aliases: ["医院", "走廊", "hospital"] },
  { id: "warehouse", facet: "scene", aliases: ["仓库", "仓储", "warehouse"] },
  { id: "plaza", facet: "scene", aliases: ["广场", "plaza"] },
  { id: "showroom", facet: "scene", aliases: ["展厅", "秀场", "showroom"] },
  { id: "park", facet: "scene", aliases: ["公园", "park"] },

  { id: "phone", facet: "object", aliases: ["手机", "电话", "phone"] },
  { id: "car", facet: "object", aliases: ["汽车", "车", "car"] },
  { id: "computer", facet: "object", aliases: ["电脑", "计算机", "显示器", "computer"] },
  { id: "ball", facet: "object", aliases: ["篮球", "球", "ball"] },
  { id: "pan", facet: "object", aliases: ["锅", "平底锅", "pan"] },
  { id: "forklift", facet: "object", aliases: ["叉车", "forklift"] },
  { id: "desk", facet: "object", aliases: ["桌子", "书桌", "desk"] },

  { id: "doctor", facet: "role", aliases: ["医生", "大夫", "doctor"] },
  { id: "chef", facet: "role", aliases: ["厨师", "chef"] },
  { id: "worker", facet: "role", aliases: ["工人", "工人师傅", "worker"] },
  { id: "athlete", facet: "role", aliases: ["球员", "运动员", "athlete"] },
  { id: "host", facet: "role", aliases: ["主持人", "host"] },
  { id: "model", facet: "role", aliases: ["模特", "model"] },
];

export const CONCEPT_BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));

export const ALIAS_INDEX: { alias: string; id: string; facet: Facet }[] = CONCEPTS.flatMap((c) =>
  c.aliases
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((alias) => ({ alias, id: c.id, facet: c.facet })),
);

export function matchConcepts(text: string): { id: string; facet: Facet }[] {
  const found = new Map<string, Facet>();
  const lower = text.toLowerCase();
  const used = new Array<boolean>(lower.length).fill(false);
  const sorted = ALIAS_INDEX.slice().sort((a, b) => b.alias.length - a.alias.length);
  for (const row of sorted) {
    if (found.has(row.id)) continue;
    const alias = row.alias.toLowerCase();
    let from = 0;
    while (from <= lower.length - alias.length) {
      const at = lower.indexOf(alias, from);
      if (at < 0) break;
      let overlap = false;
      for (let i = at; i < at + alias.length; i++) {
        if (used[i]) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        found.set(row.id, row.facet);
        for (let i = at; i < at + alias.length; i++) used[i] = true;
        break;
      }
      from = at + 1;
    }
  }
  return [...found.entries()].map(([id, facet]) => ({ id, facet }));
}

export function labelOf(id: string): string {
  const c = CONCEPT_BY_ID.get(id);
  return c?.aliases[0] ?? id;
}
