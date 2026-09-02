import fs from "fs";
import path from "path";

const modelServerPath = path.resolve("colab/model_server.py");
const notebookPath = path.resolve("colab/frameseek_colab_runner.ipynb");

const modelServerCode = fs.readFileSync(modelServerPath, "utf-8");
const nbRaw = fs.readFileSync(notebookPath, "utf-8");
const nb = JSON.parse(nbRaw);

const cell3Source = [
  "# 3. 克隆或拉取 GitHub 仓库最新代码 (强制重置同步，避免本地文件冲突)\n",
  "import os\n",
  "import sys\n",
  "\n",
  'REPO_URL = "https://github.com/bycainiu/zhensuo.git"\n',
  'WORK_DIR = "/content/zhensuo"\n',
  "\n",
  'if os.path.exists(WORK_DIR) and os.path.exists(os.path.join(WORK_DIR, ".git")):\n',
  '    print("🔄 检测到已存在项目目录，正在强制同步最新代码 (自动重置覆盖本地缓存)...")\n',
  "    !cd {WORK_DIR} && git fetch origin main && git reset --hard origin/main && git clean -fd\n",
  "else:\n",
  '    print(f"📦 正在克隆 GitHub 仓库: {REPO_URL}...")\n',
  "    !rm -rf {WORK_DIR}\n",
  "    !git clone {REPO_URL} {WORK_DIR}\n",
  "\n",
  "if WORK_DIR not in sys.path:\n",
  "    sys.path.insert(0, WORK_DIR)\n",
  "\n",
  'print(f"✅ 项目工作区就绪: {WORK_DIR}")'
];

const cell6Source = [
  "# 6. 编写并启动真实加载 GPU 神经网络显存与多模态图文视觉嵌入的 model_server.py\n",
  "import os\n",
  "import subprocess\n",
  "import time\n",
  "import requests\n",
  "\n",
  "MODEL_SERVER_CODE = '''" + modelServerCode.replace(/\\/g, "\\\\") + "'''\n",
  "\n",
  'with open("/content/model_server.py", "w", encoding="utf-8") as f:\n',
  "    f.write(MODEL_SERVER_CODE)\n",
  "\n",
  'os.makedirs("/content/zhensuo/colab", exist_ok=True)\n',
  'with open("/content/zhensuo/colab/model_server.py", "w", encoding="utf-8") as f:\n',
  "    f.write(MODEL_SERVER_CODE)\n",
  "\n",
  "!fuser -k 8000/tcp || true\n",
  "time.sleep(1)\n",
  "\n",
  'log_file = open("/content/model_server.log", "w", encoding="utf-8")\n',
  'proc = subprocess.Popen(["python3", "/content/model_server.py"], stdout=log_file, stderr=subprocess.STDOUT)\n',
  'print(f"🚀 正在启动后台 GPU 模型服务 (PID: {proc.pid})...")\n',
  "\n",
  "is_ready = False\n",
  "for i in range(15):\n",
  "    time.sleep(1)\n",
  "    try:\n",
  '        r = requests.get("http://127.0.0.1:8000/api/v1/health", timeout=1)\n',
  "        if r.status_code == 200:\n",
  "            is_ready = True\n",
  "            break\n",
  "    except Exception:\n",
  "        pass\n",
  "\n",
  "try:\n",
  '    ts_ip = subprocess.check_output(["tailscale", "ip", "-4"]).decode().strip().split(\'\\n\')[0]\n',
  "except Exception:\n",
  '    ts_ip = "127.0.0.1"\n',
  "\n",
  "if is_ready:\n",
  '    print("\\n" + "="*65)\n',
  '    print("🎉 FrameSeek GPU 模型加速服务已就绪 (Tailscale 私网模式)！")\n',
  '    print(f"🔗 【Tailscale 内网直连地址】: http://{ts_ip}:8000")\n',
  '    print("="*65)\n',
  "else:\n",
  '    print("❌ 服务启动超时，日志如下：")\n',
  '    with open("/content/model_server.log", "r", encoding="utf-8") as f:\n',
  "        print(f.read())\n"
];

for (const cell of nb.cells) {
  if (cell.cell_type === "code") {
    const sourceStr = (cell.source || []).join("");
    if (sourceStr.includes("REPO_URL") || sourceStr.includes("WORK_DIR")) {
      cell.source = cell3Source;
      cell.outputs = [];
      console.log("✅ 成功优化 Step 3 代码拉取单元！");
    }
    if (sourceStr.includes("MODEL_SERVER_CODE") || sourceStr.includes("model_server.py")) {
      cell.source = cell6Source;
      console.log("✅ 成功匹配并更新 Step 6 启动 Cell！");
    }
  }
}

fs.writeFileSync(notebookPath, JSON.stringify(nb, null, 1), "utf-8");
console.log("🎉 colab/frameseek_colab_runner.ipynb 同步写入完成！");
