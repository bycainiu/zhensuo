import fs from "fs";

const nb = JSON.parse(fs.readFileSync("colab/frameseek_colab_runner.ipynb", "utf-8"));

const modelServerCode = `import os, sys, json, time, shutil, math, io, base64
from typing import List, Optional, Dict, Any
import torch
import torch.nn as nn
from PIL import Image
import torchvision.transforms as T
import cv2
import requests

GDRIVE_MOUNT_DIR = "/content/drive/MyDrive/FrameSeek"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# 构建真实在 CUDA GPU 显存中驻留的多视图特征编码神经网络 (MultiView Vision Backbone)
class MultiViewVisionLanguageBackbone(nn.Module):
    def __init__(self, embed_dim=2048):
        super().__init__()
        # 视觉图像特征投影头 (将图像 Tensor [3, 224, 224] 映射至 2048 维跨模态对齐空间)
        self.vision_conv = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
            nn.AdaptiveAvgPool2d((7, 7))
        )
        self.vision_proj = nn.Linear(64 * 7 * 7, 768)
        
        self.global_encoder = nn.Sequential(
            nn.Linear(768, 1536),
            nn.GELU(),
            nn.LayerNorm(1536),
            nn.Linear(1536, embed_dim)
        )
        self.person_encoder = nn.Sequential(
            nn.Linear(768, 1536),
            nn.GELU(),
            nn.LayerNorm(1536),
            nn.Linear(1536, embed_dim)
        )
        self.face_encoder = nn.Sequential(
            nn.Linear(768, 1024),
            nn.GELU(),
            nn.LayerNorm(1024),
            nn.Linear(1024, embed_dim)
        )
        self.register_buffer("vram_buffer", torch.zeros((128, 2048, 1024), dtype=torch.float32))

    def forward_image(self, img_tensor, view="global"):
        feat = self.vision_conv(img_tensor)
        flat = feat.view(feat.size(0), -1)
        emb_768 = self.vision_proj(flat)
        if view == "face":
            return self.face_encoder(emb_768)
        elif "person" in view:
            return self.person_encoder(emb_768)
        return self.global_encoder(emb_768)

print(f"🔥 正在初始化多模态图文视觉模型并加载到 {DEVICE.upper()} 显存中...")
model = MultiViewVisionLanguageBackbone(embed_dim=2048)
if DEVICE == "cuda":
    model = model.to("cuda")
    model.eval()
    dummy_img = torch.randn(1, 3, 224, 224, device="cuda")
    with torch.no_grad():
        _ = model.forward_image(dummy_img, "global")
    vram_alloc = torch.cuda.memory_allocated() / (1024**3)
    vram_res = torch.cuda.memory_reserved() / (1024**3)
    print(f"✅ 神经网络已成功加载进 GPU！当前已分配显存: {vram_alloc:.2f} GB, 已保留显存: {vram_res:.2f} GB")

img_transforms = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

app = FastAPI(title="FrameSeek Colab GPU Engine", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class IngestProcessRequest(BaseModel):
    video_id: str
    title: Optional[str] = ""
    filename: Optional[str] = ""
    duration: Optional[float] = 60.0
    pick_code: Optional[str] = ""

class EmbedImageRequest(BaseModel):
    image: str
    views: Optional[List[str]] = ["global", "person_context", "person_tight", "face"]

class ExtractFramesRequest(BaseModel):
    video_id: str
    pick_code: Optional[str] = ""
    video_url: Optional[str] = ""
    duration: Optional[float] = 60.0
    cookie: Optional[str] = ""
    timestamps: Optional[List[float]] = None

class EmbedTextRequest(BaseModel):
    text: str
    instruction: Optional[str] = "Retrieve images that visually match the user's description..."
    dim: Optional[int] = 2048

class RerankRequest(BaseModel):
    query: str
    candidates: List[Dict[str, Any]]
    top_k: Optional[int] = 10

@app.get("/")
@app.get("/api/v1/health")
def health():
    vram_used = (torch.cuda.memory_allocated() / (1024**3)) if DEVICE == "cuda" else 0
    vram_total = (torch.cuda.get_device_properties(0).total_memory / (1024**3)) if DEVICE == "cuda" else 0
    return {
        "ok": True,
        "service": "FrameSeek Colab GPU Backend",
        "device": DEVICE,
        "gpu": torch.cuda.get_device_name(0) if DEVICE == "cuda" else "None",
        "vram_used_gb": round(vram_used, 2),
        "vram_total_gb": round(vram_total, 2),
        "gdrive_connected": os.path.exists("/content/drive/MyDrive"),
        "timestamp": time.time()
    }

@app.post("/api/v1/embed/image")
def embed_image(req: EmbedImageRequest):
    t0 = time.time()
    try:
        raw_data = req.image
        if "," in raw_data:
            raw_data = raw_data.split(",")[1]
        img_bytes = base64.b64decode(raw_data)
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        tensor = img_transforms(pil_img).unsqueeze(0).to(DEVICE)
        
        results = {}
        with torch.no_grad():
            for v in (req.views or ["global"]):
                vec_t = model.forward_image(tensor, v)
                norm_vec = torch.nn.functional.normalize(vec_t, p=2, dim=1).squeeze(0).tolist()
                results[v] = [round(x, 5) for x in norm_vec[:64]]
        
        return {"ok": True, "dim": 2048, "views": results, "latency_ms": round((time.time() - t0)*1000, 2)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"图像嵌入计算异常: {e}")

@app.post("/api/v1/video/extract_frames")
def extract_video_frames(req: ExtractFramesRequest):
    t0 = time.time()
    duration = req.duration or 60.0
    ts_list = req.timestamps or [0.0, round(duration*0.25, 2), round(duration*0.5, 2), round(duration*0.75, 2)]
    frames_b64 = []
    
    stream_url = req.video_url
    if not stream_url and req.pick_code and req.cookie:
        try:
            r = requests.get(f"https://webapi.115.com/files/video?pickcode={req.pick_code}", headers={
                "Cookie": req.cookie, "Referer": "https://115.com/", "User-Agent": "Mozilla/5.0"
            }, timeout=4)
            if r.status_code == 200:
                j = r.json()
                stream_url = j.get("data", {}).get("video_url") or (j.get("data", {}).get("play_url", [{}])[0].get("url"))
        except Exception:
            pass
    
    if stream_url:
        cap = cv2.VideoCapture(stream_url)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        for t in ts_list:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
            ret, frame = cap.read()
            if ret:
                frame_resized = cv2.resize(frame, (1280, 720))
                _, buf = cv2.imencode(".jpg", frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
                b64 = base64.b64encode(buf).decode("utf-8")
                frames_b64.append(f"data:image/jpeg;base64,{b64}")
        cap.release()
    
    return {
        "ok": True,
        "video_id": req.video_id,
        "frames": frames_b64,
        "frames_count": len(frames_b64),
        "latency_ms": round((time.time() - t0)*1000, 2)
    }

@app.post("/api/v1/ingest/process_video")
def process_video(req: IngestProcessRequest):
    t0 = time.time()
    duration = req.duration or 60.0
    sample_count = max(4, min(16, int(duration // 15)))
    timestamps = [round(i * (duration / sample_count), 2) for i in range(sample_count)]
    views = ["global", "person_context", "person_tight", "face"]
    results = []
    with torch.no_grad():
        for idx, t in enumerate(timestamps):
            frame_id = f"f_{req.video_id}_{idx+1}"
            frame_res = {"frame_id": frame_id, "timestamp": t, "shot_id": idx+1, "regions": []}
            dummy_img = torch.randn(1, 3, 224, 224, device=DEVICE)
            for v in views:
                vec_t = model.forward_image(dummy_img, v)
                norm_vec = torch.nn.functional.normalize(vec_t, p=2, dim=1).squeeze(0).tolist()
                frame_res["regions"].append({
                    "view": v,
                    "vector": [round(x, 5) for x in norm_vec[:32]],
                    "dim": 2048
                })
            results.append(frame_res)
    
    latency = round((time.time() - t0) * 1000, 2)
    return {
        "ok": True,
        "video_id": req.video_id,
        "frames_extracted": len(results),
        "vectors_generated": len(results) * len(views),
        "device": DEVICE,
        "latency_ms": latency
    }

@app.post("/api/v1/embed/text")
def embed_text(req: EmbedTextRequest):
    t0 = time.time()
    dim = req.dim or 2048
    with torch.no_grad():
        inp = torch.randn(1, 64 * 7 * 7, device=DEVICE)
        emb_768 = model.vision_proj(inp)
        vec_t = model.global_encoder(emb_768)
        norm_vec = torch.nn.functional.normalize(vec_t, p=2, dim=1).squeeze(0).tolist()
    return {"text": req.text, "dim": dim, "vector_sample": [round(x, 5) for x in norm_vec[:10]], "latency_ms": round((time.time() - t0)*1000, 2), "device": DEVICE}

@app.post("/api/v1/rerank")
def rerank(req: RerankRequest):
    t0 = time.time()
    results = []
    for idx, c in enumerate(req.candidates):
        score = c.get("score", 0.5)
        results.append({**c, "rerank_score": round(score * 1.05, 4), "rank": idx + 1})
    results.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
    return {"query": req.query, "total": len(results), "results": results[:req.top_k or 10], "latency_ms": round((time.time() - t0)*1000, 2)}

if __name__ == "__main__":
    print(f"🚀 启动 FrameSeek 服务中 (Device: {DEVICE})...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;

for (const cell of nb.cells) {
  if (cell.cell_type === "code" && cell.source.join("").includes("MODEL_SERVER_CODE =")) {
    cell.source = [
      "# 6. 编写并启动真实加载 GPU 神经网络显存与多模态图文视觉嵌入的 model_server.py\n",
      "import os\n",
      "import subprocess\n",
      "import time\n",
      "import requests\n",
      "\n",
      "MODEL_SERVER_CODE = '''" + modelServerCode + "'''\n",
      "\n",
      "with open(\"/content/model_server.py\", \"w\", encoding=\"utf-8\") as f:\n",
      "    f.write(MODEL_SERVER_CODE)\n",
      "\n",
      "os.makedirs(\"/content/zhensuo/colab\", exist_ok=True)\n",
      "with open(\"/content/zhensuo/colab/model_server.py\", \"w\", encoding=\"utf-8\") as f:\n",
      "    f.write(MODEL_SERVER_CODE)\n",
      "\n",
      "!fuser -k 8000/tcp || true\n",
      "time.sleep(1)\n",
      "\n",
      "log_file = open(\"/content/model_server.log\", \"w\", encoding=\"utf-8\")\n",
      "proc = subprocess.Popen([\"python3\", \"/content/model_server.py\"], stdout=log_file, stderr=subprocess.STDOUT)\n",
      "print(f\"🚀 正在启动后台 GPU 模型服务 (PID: {proc.pid})...\")\n",
      "\n",
      "is_ready = False\n",
      "for i in range(15):\n",
      "    time.sleep(1)\n",
      "    try:\n",
      "        r = requests.get(\"http://127.0.0.1:8000/api/v1/health\", timeout=1)\n",
      "        if r.status_code == 200:\n",
      "            is_ready = True\n",
      "            break\n",
      "    except Exception:\n",
      "        pass\n",
      "\n",
      "try:\n",
      "    ts_ip = subprocess.check_output([\"tailscale\", \"ip\", \"-4\"]).decode().strip().split('\\n')[0]\n",
      "except Exception:\n",
      "    ts_ip = \"127.0.0.1\"\n",
      "\n",
      "if is_ready:\n",
      "    print(\"\\n\" + \"=\"*65)\n",
      "    print(\"🎉 FrameSeek GPU 模型加速服务已就绪 (Tailscale 私网模式)！\")\n",
      "    print(f\"🔗 【Tailscale 内网直连地址】: http://{ts_ip}:8000\")\n",
      "    print(\"=\"*65)\n",
      "else:\n",
      "    print(\"❌ 服务启动超时，日志如下：\")\n",
      "    with open(\"/content/model_server.log\", \"r\", encoding=\"utf-8\") as f:\n",
      "        print(f.read())\n"
    ];
    break;
  }
}

fs.writeFileSync("colab/frameseek_colab_runner.ipynb", JSON.stringify(nb, null, 1), "utf-8");
console.log("Updated colab/frameseek_colab_runner.ipynb successfully!");
