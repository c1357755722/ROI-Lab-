# ROI-Lab-
该工具可无限划分roi区域，直接导出csv表格，自定义roi区域名称。
# ROI Lab Prototype

这是当前 ROI Lab 工具的开发工程目录。

## 当前形态

- 本体是一个本地网页工具
- 可通过 `Python + 本地服务` 运行
- 也可打包成 `离线网页发布包` 给没有开发环境的电脑直接使用

## 开发入口

- 启动本地服务：`run_app.py`
- 启动脚本：`launch_roi_lab_tool.bat`
- 前端源码：`web\`

## 打包入口

- 打包脚本：`tools\build_portable_web_package.ps1`

运行后会生成：

- 发布目录：`dist\ROI_Lab_Portable_Web\`
- 发布压缩包：`dist\ROI_Lab_Portable_Web.zip`

## 目录说明

- `web\`
  前端源码，包含页面、样式和交互逻辑。

- `dist\`
  发布成品目录，给最终使用者使用。

- `docs\`
  说明文档、发布说明、文件分类说明。

- `tools\`
  打包脚本和后续工具脚本。

- `run_app.py`
  本地 HTTP 服务启动脚本。

- `launch_roi_lab_tool.bat`
  优先尝试 Python 本地服务；如果没有 Python，可退回离线网页方式。

- `launch_offline.bat`
  直接打开离线网页版本。

## 当前功能

- 批量导入图片
- 多 ROI 手动圈选
- 支持方块、圆形、自定义 ROI
- ROI 自动计算 Lab
- 支持缩放、平移、右侧整体滚动
- 批量命名与 CSV 导出

