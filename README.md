# 🛠️ ROI Lab: 图像感兴趣区域提取与 CIELAB 色度分析系统

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue)](https://www.python.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com)

**ROI Lab** 是一款专为图像处理、计算机视觉及定量颜色分析设计的高效轻量级交互工具。系统支持多拓扑异构区域（矩形、圆形、自定义多边形）的无限量手动分割与动态命名，内置高精度 CIELAB 色度空间自动量化算法，并提供一键式结构化数据（CSV）高通量导出功能。

---

## ✨ 核心功能特性 (Key Features)

* **📊 高通量批处理**：支持大规模图像流的批量导入与序列化解析，优化学术研究中的重复性劳动。
* **📐 多模态拓扑区域圈选**：打破传统单一几何限制，完美支持**矩形（方块）**、**圆形**及**任意几何多边形（自定义 ROI）**的精准重构。
* **🎨 CIELAB 色度空间动态量化**：像素级自动覆盖分析，实时计算并输出选定 ROI 区域的平均颜色度量值（$L^*, a^*, b^*$ 空间表征）。
* **🔍 智能交互系统**：无缝集成视口缩放（Zooming）、全景平移（Panning）以及右侧全局滚动看板，确保在超高分辨率图像下依然保持优异的操控精度。
* **💾 结构化数据导出**：支持自定义 ROI 语义命名，数据一键对齐并导出为标准 `.csv` 矩阵，便于后续使用 Python、R 或 MATLAB 进行统计学分析。

---

## 🚀 运行模式与部署说明 (Deployment)

本系统采用**双端自适应运行架构**，兼顾科研开发者的定制需求与跨平台终端用户的即插即用体验。

### 模式 A：基于 Python 的本地服务器模式（推荐开发环境）
依赖 Python 环境，适合需要二次开发或调试的用户。
```bash
# 启动本地 HTTP 运行时服务
python run_app.py

```

*您也可以直接双击运行快捷脚本：`launch_roi_lab_tool.bat*`

### 模式 B：解耦型离线网页模式（零环境依赖）

无需安装任何运行环境，解压即用，适合分发给团队协同人员。

* **自适应启动**：运行 `launch_roi_lab_tool.bat` 时，系统将优先检测 Python 环境；若缺失，则自动平滑降级至纯离线网页模式。
* **强力启动**：直接运行 `launch_offline.bat`，直接调用默认浏览器挂载静态解析引擎。

---

## 📦 项目打包与分发 (Distribution)

为了便于科研成果的转换与跨设备部署，项目内置了自动化构建脚本：

* **打包脚本路径**：`tools\build_portable_web_package.ps1` （PowerShell 环境）

**构建产物：**

* **发布目录**：`dist\ROI_Lab_Portable_Web\`
* **发布压缩包**：`dist\ROI_Lab_Portable_Web.zip`

---

## 📂 目录结构解析 (Directory Topology)

```text
ROI-Lab/
├── web/                           # 前端核心源码（包含页面架构、CSS样式及核心交互逻辑）
├── dist/                          # 编译与生产环境分发成品目录（最终用户端）
├── docs/                          # 系统技术文档、发布说明及资产分类归档
├── tools/                         # 自动化打包脚本及后续数据处理工具链
├── run_app.py                     # 基于 Python 的本地 HTTP 轻量级服务启动脚本
├── launch_roi_lab_tool.bat        # 智能自适应环境启动脚本（Python 服务优先）
└── launch_offline.bat             # 纯静态离线轻量化启动脚本

```

---

## 📝 许可协议 (License)

本项目基于 **MIT License** 开源协议。详情请参阅 [LICENSE](https://www.google.com/search?q=LICENSE) 文件。

```

---

### 💡 建议添加的后续学术模块（可选）
如果您打算将该项目挂载在 GitHub 并用于学术论文发表，建议在后续条件允许时，在 README 的最下方补充以下两个板块：
1. **Citation（引用声明）**：给出您论文发表后的正式 `BibTeX` 格式，方便同行在引用该软件时直接复制。
2. **Screenshots / Demo（系统演示）**：在“核心功能特性”下方插入 1~2 张系统运行时的动图（`.gif`）或高分辨率截图，GitHub 的视觉审阅对此非常看重。

```
