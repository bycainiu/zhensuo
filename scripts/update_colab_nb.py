import json

# 读取最新的 model_server.py 内容
with open('colab/model_server.py', 'r', encoding='utf-8') as f:
    model_server_code = f.read()

# 读取 notebook
with open('colab/frameseek_colab_runner.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# 更新步骤 6 对应的 Cell 源码
cell_6_source = [
    "# 6. 编写并启动真实加载 GPU 神经网络显存与多模态图文视觉嵌入的 model_server.py\n",
    "import os\n",
    "import subprocess\n",
    "import time\n",
    "import requests\n",
    "\n",
    "MODEL_SERVER_CODE = '''" + model_server_code.replace("\\", "\\\\") + "'''\n",
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
]

# 找到包含 MODEL_SERVER_CODE 的 cell
for cell in nb['cells']:
    if cell.get('cell_type') == 'code':
        source_str = "".join(cell.get('source', []))
        if "MODEL_SERVER_CODE" in source_str or "model_server.py" in source_str:
            cell['source'] = cell_6_source
            print("✅ 成功匹配并更新 Step 6 启动 Cell！")
            break

with open('colab/frameseek_colab_runner.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, ensure_ascii=False, indent=1)

print("🎉 colab/frameseek_colab_runner.ipynb 同步写入完成！")
