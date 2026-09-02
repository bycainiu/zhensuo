"""
FrameSeek - Google Drive 资产与索引同步工具
用于将 115 视频抽帧、多视图特征向量库与元数据同步至 Google Drive 进行持久化存储与多端共享。
"""

import os
import sys
import json
import shutil
from pathlib import Path

DEFAULT_GDRIVE_DIR = "/content/drive/MyDrive/FrameSeek"
LOCAL_EXPORT_DIR = "./gdrive_export"

def check_gdrive_mounted() -> bool:
    return os.path.exists("/content/drive/MyDrive")

def mount_gdrive():
    try:
        from google.colab import drive
        print("📁 正在挂载 Google Drive...")
        drive.mount("/content/drive")
        print("✅ Google Drive 挂载成功！")
        return True
    except Exception as e:
        print(f"⚠️ 挂载失败或非 Colab 环境: {e}")
        return False

def init_gdrive_workspace(base_dir=DEFAULT_GDRIVE_DIR):
    """
    初始化 Google Drive 中的 FrameSeek 工作空间目录结构
    """
    folders = [
        "raw_videos",       # 原始 115 视频素材存储
        "extracted_frames", # 抽帧关键帧与 4-View Crop 图像
        "vector_indices",   # Qdrant / LanceDB 向量数据库持久化文件
        "export_projects",  # 导出的 FCPXML / EDL 剪辑工程
        "checkpoints",      # 模型微调与权重缓存
    ]
    created = []
    for f in folders:
        p = os.path.join(base_dir, f)
        os.makedirs(p, exist_ok=True)
        created.append(p)
    print(f"✅ Google Drive FrameSeek 工作目录已就绪: {base_dir}")
    return created

def sync_local_to_gdrive(local_path: str, gdrive_subfolder: str):
    """
    将本地生成的索引或抽帧复制到 Google Drive
    """
    if not check_gdrive_mounted():
        print("⚠️ 未检测到 Google Drive 挂载，跳过同步。")
        return False
    
    dest_dir = os.path.join(DEFAULT_GDRIVE_DIR, gdrive_subfolder)
    os.makedirs(dest_dir, exist_ok=True)
    
    if os.path.isfile(local_path):
        shutil.copy2(local_path, dest_dir)
        print(f"✅ 已同步文件到 Google Drive: {dest_dir}")
    elif os.path.isdir(local_path):
        for item in os.listdir(local_path):
            s = os.path.join(local_path, item)
            d = os.path.join(dest_dir, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)
        print(f"✅ 已同步目录到 Google Drive: {dest_dir}")
    return True

if __name__ == "__main__":
    if check_gdrive_mounted():
        init_gdrive_workspace()
    else:
        print("提示: 在 Google Colab 中运行本脚本时，会自动执行 drive.mount('/content/drive') 并初始化同步。")
