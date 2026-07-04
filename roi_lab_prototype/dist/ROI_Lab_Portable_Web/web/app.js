const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 1000;
const ROI_SHAPES = {
  RECT: "rect",
  CIRCLE: "circle",
  LASSO: "lasso",
};

const state = {
  samples: [],
  currentIndex: -1,
  currentRaster: null,
  nextSampleId: 1,
  nextRoiId: 1,
  activeShape: ROI_SHAPES.RECT,
  view: {
    cssWidth: 0,
    cssHeight: 0,
    baseScale: 1,
    zoom: 1,
    scale: 1,
    panX: 0.5,
    panY: 0.5,
    offsetX: 0,
    offsetY: 0,
    imageWidth: 0,
    imageHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
    overflowX: 0,
    overflowY: 0,
    padding: 24,
  },
  drag: null,
  panDrag: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  bindGlobalErrorHandlers();
  syncZoomUi();
  resizeViewer();
  updateMetaPanels();
  drawViewer();
  maybeLoadDemoSample();
});

function bindElements() {
  elements.fileInput = document.getElementById("fileInput");
  elements.folderInput = document.getElementById("folderInput");
  elements.templateInput = document.getElementById("templateInput");
  elements.sampleNameInput = document.getElementById("sampleNameInput");
  elements.sampleStepInput = document.getElementById("sampleStepInput");
  elements.viewerTitle = document.getElementById("viewerTitle");
  elements.viewerWrap = document.getElementById("viewerWrap");
  elements.viewerStage = document.getElementById("viewerStage");
  elements.viewerImage = document.getElementById("viewerImage");
  elements.viewerCanvas = document.getElementById("viewerCanvas");
  elements.panTrackX = document.getElementById("panTrackX");
  elements.panTrackY = document.getElementById("panTrackY");
  elements.panThumbX = document.getElementById("panThumbX");
  elements.panThumbY = document.getElementById("panThumbY");
  elements.imageMeta = document.getElementById("imageMeta");
  elements.labMeta = document.getElementById("labMeta");
  elements.statusBox = document.getElementById("statusBox");
  elements.sampleTableBody = document.getElementById("sampleTableBody");
  elements.sampleCount = document.getElementById("sampleCount");
  elements.zoomInput = document.getElementById("zoomInput");
  elements.zoomPercentInput = document.getElementById("zoomPercentInput");
  elements.zoomValue = document.getElementById("zoomValue");
  elements.roiShapeInputs = Array.from(document.querySelectorAll('input[name="roiShape"]'));

  elements.applyTemplateBtn = document.getElementById("applyTemplateBtn");
  elements.saveSampleNameBtn = document.getElementById("saveSampleNameBtn");
  elements.measureCurrentBtn = document.getElementById("measureCurrentBtn");
  elements.exportBtn = document.getElementById("exportBtn");
  elements.clearRoiBtn = document.getElementById("clearRoiBtn");
  elements.copyRoiBtn = document.getElementById("copyRoiBtn");
  elements.zoomOutBtn = document.getElementById("zoomOutBtn");
  elements.zoomInBtn = document.getElementById("zoomInBtn");
  elements.fitViewBtn = document.getElementById("fitViewBtn");
}

function bindEvents() {
  elements.fileInput.addEventListener("change", (event) => {
    handleFileSelection(event.target.files);
    event.target.value = "";
  });

  elements.folderInput.addEventListener("change", (event) => {
    handleFileSelection(event.target.files);
    event.target.value = "";
  });

  elements.zoomInput.addEventListener("input", () => {
    setZoom(Number(elements.zoomInput.value) / 100, { announce: false });
  });
  elements.zoomPercentInput.addEventListener("change", commitZoomPercentInput);
  elements.zoomPercentInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      commitZoomPercentInput();
      elements.zoomPercentInput.blur();
    }
  });
  elements.roiShapeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.activeShape = input.value;
      }
    });
  });

  elements.applyTemplateBtn.addEventListener("click", applyTemplateToAll);
  elements.saveSampleNameBtn.addEventListener("click", saveCurrentSampleName);
  elements.measureCurrentBtn.addEventListener("click", measureCurrentRoi);
  elements.exportBtn.addEventListener("click", exportCsv);
  elements.clearRoiBtn.addEventListener("click", clearCurrentRoi);
  elements.copyRoiBtn.addEventListener("click", copyCurrentRoiToAll);
  elements.zoomOutBtn.addEventListener("click", () => nudgeZoom(-1));
  elements.zoomInBtn.addEventListener("click", () => nudgeZoom(1));
  elements.fitViewBtn.addEventListener("click", () => resetZoom(true));

  elements.sampleNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      saveCurrentSampleName();
    }
  });

  const viewerCanvas = elements.viewerCanvas;
  viewerCanvas.addEventListener("pointerdown", handleCanvasPointerDown);
  viewerCanvas.addEventListener("pointermove", handleCanvasPointerMove);
  viewerCanvas.addEventListener("pointerup", handleCanvasPointerUp);
  viewerCanvas.addEventListener("pointercancel", handleCanvasPointerUp);
  viewerCanvas.addEventListener("lostpointercapture", handleCanvasPointerUp);
  viewerCanvas.addEventListener("wheel", handleCanvasWheel, { passive: false });
  elements.panTrackX.addEventListener("pointerdown", handlePanTrackPointerDown);
  elements.panTrackY.addEventListener("pointerdown", handlePanTrackPointerDown);
  elements.panTrackX.addEventListener("pointermove", handlePanTrackPointerMove);
  elements.panTrackY.addEventListener("pointermove", handlePanTrackPointerMove);
  elements.panTrackX.addEventListener("pointerup", handlePanTrackPointerUp);
  elements.panTrackY.addEventListener("pointerup", handlePanTrackPointerUp);
  elements.panTrackX.addEventListener("pointercancel", handlePanTrackPointerUp);
  elements.panTrackY.addEventListener("pointercancel", handlePanTrackPointerUp);
  elements.panTrackX.addEventListener("lostpointercapture", handlePanTrackPointerUp);
  elements.panTrackY.addEventListener("lostpointercapture", handlePanTrackPointerUp);

  window.addEventListener("resize", resizeViewer);
  new ResizeObserver(resizeViewer).observe(elements.viewerWrap);
}

function bindGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    const message = event?.error?.message || event.message || "未知前端错误";
    setStatus(`页面脚本错误：${message}`, "error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string" ? reason : reason?.message || "发生未处理的异步错误";
    setStatus(`页面异步错误：${message}`, "error");
  });
}

async function maybeLoadDemoSample() {
  const params = new URLSearchParams(window.location.search);
  const demoName = params.get("demo");
  if (!demoName) {
    return;
  }

  try {
    setStatus(`正在加载测试图片：${demoName}...`, "busy");
    const response = await fetch(`./${demoName}`);
    if (!response.ok) {
      throw new Error(`测试图片不存在：${demoName}`);
    }

    const blob = await response.blob();
    const file = new File([blob], demoName, { type: blob.type || "image/png" });
    handleFileSelection([file]);
    setStatus(`已自动加载测试图片：${demoName}`);
  } catch (error) {
    setStatus(error.message || "测试图片加载失败", "error");
  }
}

function isImageFile(file) {
  if (!file) {
    return false;
  }

  if (file.type && file.type.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g|bmp|gif|webp|tiff?)$/i.test(file.name);
}

function getStemAndExt(fileName) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 1) {
    return { stem: fileName, ext: "" };
  }

  return {
    stem: fileName.slice(0, lastDot),
    ext: fileName.slice(lastDot + 1).toLowerCase(),
  };
}

function handleFileSelection(fileList) {
  const files = Array.from(fileList || []).filter(isImageFile);
  if (!files.length) {
    setStatus("没有检测到可用图片。", "error");
    return;
  }

  files.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  for (const file of files) {
    const { stem, ext } = getStemAndExt(file.name);
    state.samples.push({
      id: state.nextSampleId++,
      file,
      stem,
      ext,
      name: stem,
      relativePath: file.webkitRelativePath || file.name,
      rois: [],
      selectedRoiId: null,
      zoom: 1,
      panX: 0.5,
      panY: 0.5,
    });
  }

  renderSampleTable();
  if (state.currentIndex < 0) {
    void selectSample(0);
  } else {
    setStatus(`已导入 ${files.length} 张图片，请在右侧手动框选 ROI。`);
  }
}

/* function renderSampleTable() {
  const tbody = elements.sampleTableBody;
  const totalRoiCount = getTotalRoiCount();
  elements.sampleCount.textContent = `${state.samples.length} 张图片 / ${totalRoiCount} 个 ROI`;

  if (!state.samples.length) {
    tbody.innerHTML =
      '<tr class="placeholder-row"><td colspan="5">导入图片后，这里会按 ROI 显示批量处理条目。</td></tr>';
    return;
  }

  let rowNumber = 1;
  const rows = [];

  state.samples.forEach((sample, sampleIndex) => {
    if (!sample.rois.length) {
      const currentClass =
        state.currentIndex === sampleIndex && !sample.selectedRoiId ? "is-current" : "";
      rows.push(`
        <tr class="${currentClass}" data-sample-index="${sampleIndex}">
          <td>${rowNumber++}</td>
          <td>${escapeHtml(sample.name)}</td>
          <td>-</td>
          <td title="${escapeHtml(sample.relativePath)}">${escapeHtml(sample.file.name)}</td>
          <td><span class="lab-tag empty">未设置 ROI</span></td>
        </tr>
      `);
      return;
    }

    sample.rois.forEach((roi, roiPosition) => {
      const currentClass =
        state.currentIndex === sampleIndex && sample.selectedRoiId === roi.id ? "is-current" : "";
      const labTag = roi.metrics
        ? `<span class="lab-tag ready">L ${roi.metrics.L_mean.toFixed(2)}</span>`
        : '<span class="lab-tag empty">未计算</span>';
      const roiEntryName = getRoiEntryName(sample, roi.id);
      const roiShape = getRoiShapeLabel(roi);

      rows.push(`
        <tr class="${currentClass}" data-sample-index="${sampleIndex}" data-roi-id="${roi.id}">
          <td>${rowNumber++}</td>
          <td>${escapeHtml(roiEntryName)}</td>
          <td>ROI ${roiPosition + 1} · ${escapeHtml(roiShape)}</td>
          <td title="${escapeHtml(sample.relativePath)}">${escapeHtml(sample.file.name)}</td>
          <td>${labTag}</td>
        </tr>
      `);
    });
  });

  tbody.innerHTML = rows.join("");
  tbody.querySelectorAll("tr[data-sample-index]").forEach((row) => {
    row.addEventListener("click", () => {
      const sampleIndex = Number(row.dataset.sampleIndex);
      const roiId = row.dataset.roiId ? Number(row.dataset.roiId) : null;
      void selectSample(sampleIndex, { roiId });
    });
  });
}

*/

function renderSampleTable() {
  const tbody = elements.sampleTableBody;
  const totalRoiCount = getTotalRoiCount();
  elements.sampleCount.textContent = `${state.samples.length} 张图片 / ${totalRoiCount} 个 ROI`;

  if (!state.samples.length) {
    tbody.innerHTML =
      '<tr class="placeholder-row"><td colspan="5">导入图片后，这里会按 ROI 显示批量处理条目。</td></tr>';
    return;
  }

  let rowNumber = 1;
  const rows = [];

  state.samples.forEach((sample, sampleIndex) => {
    if (!sample.rois.length) {
      const currentClass =
        state.currentIndex === sampleIndex && !sample.selectedRoiId ? "is-current" : "";
      rows.push(`
        <tr class="${currentClass}" data-sample-index="${sampleIndex}">
          <td>${rowNumber++}</td>
          <td>${escapeHtml(sample.name)}</td>
          <td>-</td>
          <td title="${escapeHtml(sample.relativePath)}">${escapeHtml(sample.file.name)}</td>
          <td><span class="lab-tag empty">未设置 ROI</span></td>
        </tr>
      `);
      return;
    }

    sample.rois.forEach((roi, roiPosition) => {
      const currentClass =
        state.currentIndex === sampleIndex && sample.selectedRoiId === roi.id ? "is-current" : "";
      const labTag = roi.metrics
        ? `<span class="lab-tag ready">L ${roi.metrics.L_mean.toFixed(2)}</span>`
        : '<span class="lab-tag empty">未计算</span>';
      const roiEntryName = getRoiEntryName(sample, roi.id);
      const roiShape = getRoiShapeLabel(roi);

      rows.push(`
        <tr class="${currentClass}" data-sample-index="${sampleIndex}" data-roi-id="${roi.id}">
          <td>${rowNumber++}</td>
          <td>${escapeHtml(roiEntryName)}</td>
          <td>ROI ${roiPosition + 1} · ${escapeHtml(roiShape)}</td>
          <td title="${escapeHtml(sample.relativePath)}">${escapeHtml(sample.file.name)}</td>
          <td>${labTag}</td>
        </tr>
      `);
    });
  });

  tbody.innerHTML = rows.join("");
  tbody.querySelectorAll("tr[data-sample-index]").forEach((row) => {
    row.addEventListener("click", () => {
      const sampleIndex = Number(row.dataset.sampleIndex);
      const roiId = row.dataset.roiId ? Number(row.dataset.roiId) : null;
      void selectSample(sampleIndex, { roiId });
    });
  });
}

async function selectSample(index, options = {}) {
  if (index < 0 || index >= state.samples.length) {
    return;
  }

  state.currentIndex = index;
  const sample = state.samples[index];
  if (options.roiId != null) {
    sample.selectedRoiId = options.roiId;
  } else if (sample.rois.length && !getRoiById(sample, sample.selectedRoiId)) {
    sample.selectedRoiId = sample.rois[sample.rois.length - 1].id;
  }

  state.view.zoom = sample.zoom || 1;
  state.view.panX = typeof sample.panX === "number" ? sample.panX : 0.5;
  state.view.panY = typeof sample.panY === "number" ? sample.panY : 0.5;
  syncZoomUi();
  elements.sampleNameInput.value = sample.name;
  elements.viewerTitle.textContent = sample.name || sample.file.name;
  renderSampleTable();
  await ensureRasterForCurrentSample();
  updateMetaPanels();
  drawViewer();

  const roi = getCurrentRoi(sample);
  if (roi) {
    setStatus(`当前样品：${sample.name}，当前为 ROI ${getRoiIndex(sample, roi.id)}。`);
  } else {
    setStatus(`当前样品：${sample.name}，请在图片上拖拽新建 ROI。`);
  }
}

async function decodeFileToRaster(sample) {
  let image;
  const objectUrl = URL.createObjectURL(sample.file);
  try {
    image = await loadImageElement(objectUrl);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`图片无法解码：${sample.file.name}`);
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);

  return { sampleId: sample.id, image, width, height, imageData, objectUrl };
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

async function ensureRaster(sample, keepCurrent = false) {
  if (state.currentRaster && state.currentRaster.sampleId === sample.id) {
    return state.currentRaster;
  }

  const raster = await decodeFileToRaster(sample);
  if (keepCurrent) {
    releaseRaster(state.currentRaster);
    state.currentRaster = raster;
  }
  return raster;
}

function releaseRaster(raster) {
  if (!raster) {
    return;
  }

  if (raster.objectUrl) {
    URL.revokeObjectURL(raster.objectUrl);
  }

  if (raster.image) {
    raster.image.src = "";
  }
}

async function ensureRasterForCurrentSample() {
  const sample = getCurrentSample();
  if (!sample) {
    releaseRaster(state.currentRaster);
    state.currentRaster = null;
    return null;
  }

  try {
    const raster = await ensureRaster(sample, true);
    updateViewMetrics(raster);
    return raster;
  } catch (error) {
    setStatus(error.message, "error");
    return null;
  }
}

function updateViewMetrics(raster) {
  const canvas = elements.viewerCanvas;
  const bounds = elements.viewerStage.getBoundingClientRect();
  const cssWidth = Math.max(360, Math.floor(bounds.width));
  const cssHeight = Math.max(280, Math.floor(bounds.height));
  const imageWidth = raster ? raster.width : 0;
  const imageHeight = raster ? raster.height : 0;
  const safeWidth = Math.max(120, cssWidth - state.view.padding * 2);
  const safeHeight = Math.max(120, cssHeight - state.view.padding * 2);
  const baseScale = raster
    ? Math.min(safeWidth / imageWidth, safeHeight / imageHeight, 1)
    : 1;
  const zoom = clamp(state.view.zoom || 1, MIN_ZOOM, MAX_ZOOM);
  const scale = baseScale * zoom;
  const displayWidth = raster ? imageWidth * scale : 0;
  const displayHeight = raster ? imageHeight * scale : 0;
  const overflowX = Math.max(0, displayWidth - cssWidth);
  const overflowY = Math.max(0, displayHeight - cssHeight);
  const panX = overflowX > 0 ? clamp(state.view.panX ?? 0.5, 0, 1) : 0.5;
  const panY = overflowY > 0 ? clamp(state.view.panY ?? 0.5, 0, 1) : 0.5;

  state.view = {
    ...state.view,
    cssWidth,
    cssHeight,
    baseScale,
    zoom,
    scale,
    panX,
    panY,
    offsetX: overflowX > 0 ? -overflowX * panX : (cssWidth - displayWidth) / 2,
    offsetY: overflowY > 0 ? -overflowY * panY : (cssHeight - displayHeight) / 2,
    imageWidth,
    imageHeight,
    displayWidth,
    displayHeight,
    overflowX,
    overflowY,
  };

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  syncPanUi();
}

function resizeViewer() {
  updateViewMetrics(state.currentRaster);
  updateMetaPanels();
  drawViewer();
}

function drawViewer() {
  const canvas = elements.viewerCanvas;
  const context = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const { cssWidth, cssHeight } = state.view;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const sample = getCurrentSample();
  const raster = state.currentRaster;
  elements.viewerCanvas.style.cursor = sample ? "crosshair" : "default";
  syncDisplayedImage(sample, raster);
  if (!sample || !raster) {
    return;
  }

  sample.rois.forEach((roi) => {
    drawRoiOverlay(context, sample, roi, roi.id === sample.selectedRoiId);
  });
}

function syncDisplayedImage(sample, raster) {
  const image = elements.viewerImage;
  if (!sample || !raster) {
    image.style.display = "none";
    image.removeAttribute("src");
    image.dataset.url = "";
    return;
  }

  image.style.display = "block";
  if (image.dataset.url !== raster.objectUrl) {
    image.src = raster.objectUrl;
    image.dataset.url = raster.objectUrl;
  }

  const { offsetX, offsetY, scale } = state.view;
  image.style.left = `${offsetX}px`;
  image.style.top = `${offsetY}px`;
  image.style.width = `${raster.width * scale}px`;
  image.style.height = `${raster.height * scale}px`;
}

function drawRoiOverlay(context, sample, roi, selected) {
  const display = roiToDisplayRect(roi);
  const label = String(getRoiIndex(sample, roi.id));

  context.save();
  context.strokeStyle = selected ? "#d7a74c" : "rgba(77, 124, 86, 0.95)";
  context.fillStyle = selected ? "rgba(215, 167, 76, 0.16)" : "rgba(77, 124, 86, 0.12)";
  context.lineWidth = selected ? 1.25 : 0.75;
  context.setLineDash(selected ? [8, 6] : [4, 4]);
  buildRoiPath(context, roi);
  context.fill();
  context.stroke();
  context.setLineDash([]);

  context.font = "12px 'Segoe UI', sans-serif";
  context.textBaseline = "middle";
  const labelWidth = Math.max(24, context.measureText(label).width + 12);
  const labelX = display.x + 6;
  const labelY = Math.max(6, display.y + 6);
  context.fillStyle = selected ? "#2f5f3e" : "#4d7c56";
  context.fillRect(labelX, labelY, labelWidth, 20);
  context.fillStyle = "#fff";
  context.fillText(label, labelX + 6, labelY + 10);

  if (selected && getRoiShape(roi) !== ROI_SHAPES.LASSO) {
    const handles = getHandleRects(display);
    context.fillStyle = "#2f5f3e";
    for (const handle of Object.values(handles)) {
      context.fillRect(handle.x, handle.y, handle.size, handle.size);
    }
  }
  context.restore();
}

function buildRoiPath(context, roi) {
  const display = roiToDisplayRect(roi);
  const shape = getRoiShape(roi);

  context.beginPath();
  if (shape === ROI_SHAPES.CIRCLE) {
    context.ellipse(
      display.x + display.w / 2,
      display.y + display.h / 2,
      Math.max(0.5, display.w / 2),
      Math.max(0.5, display.h / 2),
      0,
      0,
      Math.PI * 2,
    );
    return;
  }

  if (shape === ROI_SHAPES.LASSO && Array.isArray(roi.points) && roi.points.length) {
    const firstPoint = imagePointToDisplayPoint(roi.points[0]);
    context.moveTo(firstPoint.x, firstPoint.y);
    for (let index = 1; index < roi.points.length; index += 1) {
      const nextPoint = imagePointToDisplayPoint(roi.points[index]);
      context.lineTo(nextPoint.x, nextPoint.y);
    }
    context.closePath();
    return;
  }

  context.rect(display.x, display.y, display.w, display.h);
}

function roiToDisplayRect(roi) {
  return {
    x: state.view.offsetX + roi.x * state.view.scale,
    y: state.view.offsetY + roi.y * state.view.scale,
    w: roi.w * state.view.scale,
    h: roi.h * state.view.scale,
  };
}

function imagePointToDisplayPoint(point) {
  return {
    x: state.view.offsetX + point.x * state.view.scale,
    y: state.view.offsetY + point.y * state.view.scale,
  };
}

function displayToImagePoint(clientX, clientY, options = {}) {
  const { clampToImage = false } = options;
  const rect = elements.viewerCanvas.getBoundingClientRect();
  const { offsetX, offsetY, scale, imageWidth, imageHeight } = state.view;
  if (!scale || !imageWidth || !imageHeight) {
    return null;
  }

  let x = clientX - rect.left;
  let y = clientY - rect.top;
  const right = offsetX + imageWidth * scale;
  const bottom = offsetY + imageHeight * scale;

  if (!clampToImage && (x < offsetX || y < offsetY || x > right || y > bottom)) {
    return null;
  }

  x = clamp(x, offsetX, right);
  y = clamp(y, offsetY, bottom);

  return {
    x: clamp((x - offsetX) / scale, 0, imageWidth),
    y: clamp((y - offsetY) / scale, 0, imageHeight),
    displayX: x,
    displayY: y,
  };
}

function getHandleRects(displayRect) {
  const size = 12;
  const half = size / 2;
  return {
    nw: { x: displayRect.x - half, y: displayRect.y - half, size },
    ne: { x: displayRect.x + displayRect.w - half, y: displayRect.y - half, size },
    sw: { x: displayRect.x - half, y: displayRect.y + displayRect.h - half, size },
    se: {
      x: displayRect.x + displayRect.w - half,
      y: displayRect.y + displayRect.h - half,
      size,
    },
  };
}

function hitTestRoi(point, sample) {
  for (let index = sample.rois.length - 1; index >= 0; index -= 1) {
    const roi = sample.rois[index];
    if (getRoiShape(roi) !== ROI_SHAPES.LASSO) {
      const displayRect = roiToDisplayRect(roi);
      const handles = getHandleRects(displayRect);

      for (const [handleKey, handle] of Object.entries(handles)) {
        if (
          point.displayX >= handle.x &&
          point.displayX <= handle.x + handle.size &&
          point.displayY >= handle.y &&
          point.displayY <= handle.y + handle.size
        ) {
          return { mode: "resize", handle: handleKey, roiId: roi.id };
        }
      }
    }

    if (isPointInRoi(point.x, point.y, roi)) {
      return { mode: "move", roiId: roi.id };
    }
  }

  return { mode: "draw", roiId: null };
}

function handleCanvasPointerDown(event) {
  const sample = getCurrentSample();
  if (!sample || !state.currentRaster) {
    return;
  }

  const point = displayToImagePoint(event.clientX, event.clientY);
  if (!point) {
    return;
  }

  event.preventDefault();
  if (typeof elements.viewerCanvas.setPointerCapture === "function") {
    elements.viewerCanvas.setPointerCapture(event.pointerId);
  }

  const hit = hitTestRoi(point, sample);
  let roi;

  if (hit.roiId != null) {
    sample.selectedRoiId = hit.roiId;
    roi = getRoiById(sample, hit.roiId);
  } else {
    roi = createRoi(point, state.activeShape);
    sample.rois.push(roi);
    sample.selectedRoiId = roi.id;
  }

  state.drag = {
    pointerId: event.pointerId,
    mode: hit.mode,
    handle: hit.handle || "",
    roiId: roi.id,
    startPoint: point,
    startRoi: cloneRoiState(roi),
    createdNew: hit.mode === "draw",
  };

  renderSampleTable();
  updateMetaPanels();
  drawViewer();
}

function handleCanvasPointerMove(event) {
  const sample = getCurrentSample();
  if (!sample || !state.currentRaster) {
    return;
  }

  const point = displayToImagePoint(event.clientX, event.clientY, {
    clampToImage: Boolean(state.drag),
  });
  if (!point) {
    elements.viewerCanvas.style.cursor = "default";
    return;
  }

  if (!state.drag) {
    const hit = hitTestRoi(point, sample);
    elements.viewerCanvas.style.cursor = cursorForHit(hit.mode, hit.handle);
    return;
  }

  if (state.drag.pointerId !== event.pointerId) {
    return;
  }

  const roi = getRoiById(sample, state.drag.roiId);
  if (!roi) {
    return;
  }

  const { imageWidth, imageHeight } = state.view;
  const shape = getRoiShape(roi);

  if (state.drag.mode === "draw") {
    if (shape === ROI_SHAPES.CIRCLE) {
      Object.assign(roi, buildCircleRoi(state.drag.startPoint, point));
    } else if (shape === ROI_SHAPES.LASSO) {
      appendFreehandPoint(roi, point);
      syncFreehandBounds(roi);
    } else {
      Object.assign(roi, buildRectRoi(state.drag.startPoint, point));
    }
  } else if (state.drag.mode === "move") {
    const dx = point.x - state.drag.startPoint.x;
    const dy = point.y - state.drag.startPoint.y;
    if (shape === ROI_SHAPES.LASSO) {
      Object.assign(roi, moveLassoRoi(state.drag.startRoi, dx, dy));
    } else {
      const moved = normalizeRoiRect({
        x: state.drag.startRoi.x + dx,
        y: state.drag.startRoi.y + dy,
        w: state.drag.startRoi.w,
        h: state.drag.startRoi.h,
      });
      moved.x = clamp(moved.x, 0, imageWidth - moved.w);
      moved.y = clamp(moved.y, 0, imageHeight - moved.h);
      Object.assign(roi, moved);
    }
  } else if (state.drag.mode === "resize") {
    if (shape === ROI_SHAPES.CIRCLE) {
      Object.assign(roi, resizeCircleFromHandle(state.drag.startRoi, point, state.drag.handle));
    } else {
      Object.assign(
        roi,
        normalizeRoiRect(resizeRectFromHandle(state.drag.startRoi, point, state.drag.handle)),
      );
    }
  }

  clearMetricsForRoi(roi);
  sample.selectedRoiId = roi.id;
  updateMetaPanels();
  drawViewer();
}

function handleCanvasPointerUp(event) {
  if (state.drag && event.pointerId != null && state.drag.pointerId !== event.pointerId) {
    return;
  }

  const sample = getCurrentSample();
  const roi = state.drag && sample ? getRoiById(sample, state.drag.roiId) : null;
  if (roi && state.drag?.mode === "draw" && getRoiShape(roi) === ROI_SHAPES.LASSO) {
    const point = displayToImagePoint(event.clientX, event.clientY, { clampToImage: true });
    if (point) {
      appendFreehandPoint(roi, point);
      syncFreehandBounds(roi);
      clearMetricsForRoi(roi);
    }
  }

  if (
    event.pointerId != null &&
    typeof elements.viewerCanvas.releasePointerCapture === "function" &&
    elements.viewerCanvas.hasPointerCapture?.(event.pointerId)
  ) {
    elements.viewerCanvas.releasePointerCapture(event.pointerId);
  }

  finalizeDrag();
}

function handleCanvasWheel(event) {
  if (!state.currentRaster) {
    return;
  }

  event.preventDefault();
  const direction = event.deltaY > 0 ? -1 : 1;
  nudgeZoom(direction);
}

function handlePanTrackPointerDown(event) {
  if (!state.currentRaster) {
    return;
  }

  const axis = event.currentTarget.dataset.axis;
  if (!canPanAxis(axis)) {
    return;
  }

  event.preventDefault();
  const coordinate = axis === "x" ? event.clientX : event.clientY;
  if (event.target === event.currentTarget) {
    jumpPanToCoordinate(axis, coordinate);
  }

  state.panDrag = {
    pointerId: event.pointerId,
    axis,
    startCoord: coordinate,
    startPan: axis === "x" ? state.view.panX : state.view.panY,
  };

  if (typeof event.currentTarget.setPointerCapture === "function") {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
}

function handlePanTrackPointerMove(event) {
  if (!state.panDrag || state.panDrag.pointerId !== event.pointerId) {
    return;
  }

  const axis = state.panDrag.axis;
  const metrics = getPanMetrics(axis);
  if (!metrics.travel) {
    return;
  }

  const coordinate = axis === "x" ? event.clientX : event.clientY;
  const delta = coordinate - state.panDrag.startCoord;
  setPan(axis, state.panDrag.startPan + delta / metrics.travel);
}

function handlePanTrackPointerUp(event) {
  if (!state.panDrag || state.panDrag.pointerId !== event.pointerId) {
    return;
  }

  const track = event.currentTarget;
  if (
    typeof track.releasePointerCapture === "function" &&
    track.hasPointerCapture?.(event.pointerId)
  ) {
    track.releasePointerCapture(event.pointerId);
  }

  state.panDrag = null;
}

function finalizeDrag() {
  const sample = getCurrentSample();
  if (!state.drag || !sample) {
    state.drag = null;
    return;
  }

  const roi = getRoiById(sample, state.drag.roiId);
  const shouldRemove =
    roi &&
    (getRoiShape(roi) === ROI_SHAPES.LASSO
      ? roi.points?.length < 3 || roi.w < 3 || roi.h < 3
      : roi.w < 3 || roi.h < 3);
  if (shouldRemove) {
    sample.rois = sample.rois.filter((item) => item.id !== roi.id);
    if (sample.selectedRoiId === roi.id) {
      sample.selectedRoiId = sample.rois.length ? sample.rois[sample.rois.length - 1].id : null;
    }
  }

  renderSampleTable();
  updateMetaPanels();
  drawViewer();
  state.drag = null;

  if (roi && !shouldRemove && !roi.metrics) {
    void autoMeasureRoi(sample, roi);
  }
}

function cursorForHit(mode, handle) {
  if (mode === "move") {
    return "move";
  }

  if (mode === "resize") {
    if (handle === "nw" || handle === "se") {
      return "nwse-resize";
    }
    return "nesw-resize";
  }

  return "crosshair";
}

function resizeRectFromHandle(startRoi, point, handle) {
  const rect = {
    left: startRoi.x,
    top: startRoi.y,
    right: startRoi.x + startRoi.w,
    bottom: startRoi.y + startRoi.h,
  };

  if (handle.includes("n")) {
    rect.top = point.y;
  }
  if (handle.includes("s")) {
    rect.bottom = point.y;
  }
  if (handle.includes("w")) {
    rect.left = point.x;
  }
  if (handle.includes("e")) {
    rect.right = point.x;
  }

  return {
    x: rect.left,
    y: rect.top,
    w: rect.right - rect.left,
    h: rect.bottom - rect.top,
  };
}

function resizeCircleFromHandle(startRoi, point, handle) {
  const anchor = {
    nw: { x: startRoi.x + startRoi.w, y: startRoi.y + startRoi.h },
    ne: { x: startRoi.x, y: startRoi.y + startRoi.h },
    sw: { x: startRoi.x + startRoi.w, y: startRoi.y },
    se: { x: startRoi.x, y: startRoi.y },
  }[handle];

  if (!anchor) {
    return normalizeRoiRect(startRoi);
  }

  const size = Math.max(Math.abs(point.x - anchor.x), Math.abs(point.y - anchor.y), 1);
  const x = handle.includes("w") ? anchor.x - size : anchor.x;
  const y = handle.includes("n") ? anchor.y - size : anchor.y;
  return normalizeRoiRect({ x, y, w: size, h: size });
}

function buildRectRoi(startPoint, point) {
  const left = Math.min(startPoint.x, point.x);
  const top = Math.min(startPoint.y, point.y);
  const right = Math.max(startPoint.x, point.x);
  const bottom = Math.max(startPoint.y, point.y);
  return normalizeRoiRect({ x: left, y: top, w: right - left, h: bottom - top });
}

function buildCircleRoi(startPoint, point) {
  const dx = point.x - startPoint.x;
  const dy = point.y - startPoint.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const x = dx < 0 ? startPoint.x - size : startPoint.x;
  const y = dy < 0 ? startPoint.y - size : startPoint.y;
  return normalizeRoiRect({ x, y, w: size, h: size });
}

function normalizeRoiRect(roi) {
  const { imageWidth, imageHeight } = state.view;
  let x = roi.x;
  let y = roi.y;
  let w = roi.w;
  let h = roi.h;

  if (w < 0) {
    x += w;
    w = Math.abs(w);
  }

  if (h < 0) {
    y += h;
    h = Math.abs(h);
  }

  x = clamp(x, 0, imageWidth);
  y = clamp(y, 0, imageHeight);
  w = clamp(w, 0, imageWidth - x);
  h = clamp(h, 0, imageHeight - y);

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}

function createRoi(point, shape) {
  const roiShape = getRoiShape(shape);
  return {
    id: state.nextRoiId++,
    shape: roiShape,
    x: Math.round(point.x),
    y: Math.round(point.y),
    w: 1,
    h: 1,
    points: roiShape === ROI_SHAPES.LASSO ? [{ x: Math.round(point.x), y: Math.round(point.y) }] : [],
    metrics: null,
    metricsKey: "",
  };
}

function cloneRoiState(roi) {
  return {
    ...roi,
    shape: getRoiShape(roi),
    points: Array.isArray(roi.points) ? roi.points.map((point) => ({ ...point })) : [],
  };
}

function moveLassoRoi(startRoi, dx, dy) {
  const { imageWidth, imageHeight } = state.view;
  const nextDx = clamp(dx, -startRoi.x, imageWidth - (startRoi.x + startRoi.w));
  const nextDy = clamp(dy, -startRoi.y, imageHeight - (startRoi.y + startRoi.h));
  const moved = cloneRoiState(startRoi);
  moved.points = moved.points.map((point) => ({
    x: Math.round(point.x + nextDx),
    y: Math.round(point.y + nextDy),
  }));
  syncFreehandBounds(moved);
  return moved;
}

function appendFreehandPoint(roi, point) {
  if (!Array.isArray(roi.points)) {
    roi.points = [];
  }

  const nextPoint = { x: Math.round(point.x), y: Math.round(point.y) };
  const lastPoint = roi.points[roi.points.length - 1];
  if (!lastPoint) {
    roi.points.push(nextPoint);
    return;
  }

  if (Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y) >= 2) {
    roi.points.push(nextPoint);
  }
}

function syncFreehandBounds(roi) {
  const points = Array.isArray(roi.points) ? roi.points : [];
  if (!points.length) {
    roi.x = 0;
    roi.y = 0;
    roi.w = 0;
    roi.h = 0;
    return roi;
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  roi.x = Math.round(minX);
  roi.y = Math.round(minY);
  roi.w = Math.max(1, Math.round(maxX - minX));
  roi.h = Math.max(1, Math.round(maxY - minY));
  return roi;
}

function getRoiShape(roiOrShape) {
  if (!roiOrShape) {
    return ROI_SHAPES.RECT;
  }
  if (typeof roiOrShape === "string") {
    return Object.values(ROI_SHAPES).includes(roiOrShape) ? roiOrShape : ROI_SHAPES.RECT;
  }
  return getRoiShape(roiOrShape.shape);
}

/* function getRoiShapeLabel(roiOrShape) {
  const shape = getRoiShape(roiOrShape);
  if (shape === ROI_SHAPES.CIRCLE) {
    return "圆形";
  }
  if (shape === ROI_SHAPES.LASSO) {
    return "自定义";
  }
  return "方块";
}

*/

function getRoiShapeLabel(roiOrShape) {
  const shape = getRoiShape(roiOrShape);
  if (shape === ROI_SHAPES.CIRCLE) {
    return "Circle";
  }
  if (shape === ROI_SHAPES.LASSO) {
    return "Custom";
  }
  return "Square";
}

function isPointInRoi(x, y, roi) {
  const shape = getRoiShape(roi);
  if (shape === ROI_SHAPES.CIRCLE) {
    const rx = roi.w / 2;
    const ry = roi.h / 2;
    if (rx <= 0 || ry <= 0) {
      return false;
    }
    const cx = roi.x + rx;
    const cy = roi.y + ry;
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }

  if (shape === ROI_SHAPES.LASSO) {
    return isPointInPolygon(x, y, roi.points || []);
  }

  return x >= roi.x && x <= roi.x + roi.w && y >= roi.y && y <= roi.y + roi.h;
}

function isPointInPolygon(x, y, points) {
  if (!Array.isArray(points) || points.length < 3) {
    return false;
  }

  let inside = false;
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current, current += 1) {
    const currentPoint = points[current];
    const previousPoint = points[previous];
    const intersects =
      currentPoint.y > y !== previousPoint.y > y &&
      x <
        ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || Number.EPSILON) +
          currentPoint.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function syncZoomUi() {
  const zoomPercent = clamp(
    Math.round((state.view.zoom || 1) * 100),
    MIN_ZOOM_PERCENT,
    MAX_ZOOM_PERCENT,
  );
  elements.zoomInput.value = String(zoomPercent);
  elements.zoomPercentInput.value = String(zoomPercent);
  elements.zoomValue.textContent = `${zoomPercent}%`;
}

function syncPanUi() {
  syncPanAxisUi("x");
  syncPanAxisUi("y");
}

function syncPanAxisUi(axis) {
  const track = axis === "x" ? elements.panTrackX : elements.panTrackY;
  const thumb = axis === "x" ? elements.panThumbX : elements.panThumbY;
  const metrics = getPanMetrics(axis);
  const isDisabled = !metrics.overflow || !metrics.trackSize;

  track.classList.toggle("is-disabled", isDisabled);
  thumb.disabled = isDisabled;

  if (axis === "x") {
    thumb.style.width = `${metrics.thumbSize}px`;
    thumb.style.transform = `translateX(${metrics.thumbOffset}px)`;
  } else {
    thumb.style.height = `${metrics.thumbSize}px`;
    thumb.style.transform = `translateY(${metrics.thumbOffset}px)`;
  }
}

function getPanMetrics(axis) {
  const track = axis === "x" ? elements.panTrackX : elements.panTrackY;
  const viewportSize = axis === "x" ? state.view.cssWidth : state.view.cssHeight;
  const contentSize = axis === "x" ? state.view.displayWidth : state.view.displayHeight;
  const overflow = axis === "x" ? state.view.overflowX : state.view.overflowY;
  const ratio = clamp(axis === "x" ? state.view.panX ?? 0.5 : state.view.panY ?? 0.5, 0, 1);
  const trackSize = track ? (axis === "x" ? track.clientWidth : track.clientHeight) : 0;
  const visibleRatio = contentSize > 0 ? Math.min(1, viewportSize / contentSize) : 1;
  const thumbSize = trackSize
    ? overflow > 0
      ? clamp(trackSize * visibleRatio, 32, trackSize)
      : trackSize
    : 0;
  const travel = Math.max(0, trackSize - thumbSize);

  return {
    overflow,
    ratio,
    trackSize,
    thumbSize,
    thumbOffset: travel * ratio,
    travel,
  };
}

function canPanAxis(axis) {
  return axis === "x" ? state.view.overflowX > 0 : state.view.overflowY > 0;
}

function jumpPanToCoordinate(axis, clientCoordinate) {
  const track = axis === "x" ? elements.panTrackX : elements.panTrackY;
  const metrics = getPanMetrics(axis);
  if (!track || !metrics.travel) {
    return;
  }

  const rect = track.getBoundingClientRect();
  const local = axis === "x" ? clientCoordinate - rect.left : clientCoordinate - rect.top;
  const next = (local - metrics.thumbSize / 2) / metrics.travel;
  setPan(axis, next);
}

function setPan(axis, nextRatio) {
  const value = clamp(nextRatio, 0, 1);
  if (axis === "x") {
    state.view.panX = value;
  } else {
    state.view.panY = value;
  }

  const sample = getCurrentSample();
  if (sample) {
    sample.panX = state.view.panX;
    sample.panY = state.view.panY;
  }

  updateViewMetrics(state.currentRaster);
  updateMetaPanels();
  drawViewer();
}

function setZoom(nextZoom, options = {}) {
  const { announce = false } = options;
  const sample = getCurrentSample();
  state.view.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  if (sample) {
    sample.zoom = state.view.zoom;
  }

  syncZoomUi();
  updateViewMetrics(state.currentRaster);
  updateMetaPanels();
  drawViewer();

  if (announce && sample) {
    setStatus(`已将 ${sample.name} 的预览缩放调整到 ${Math.round(state.view.zoom * 100)}%。`);
  }
}

function commitZoomPercentInput() {
  const fallbackPercent = Math.round((state.view.zoom || 1) * 100);
  const rawPercent = Number(elements.zoomPercentInput.value);
  const zoomPercent = clamp(
    Number.isFinite(rawPercent) ? rawPercent : fallbackPercent,
    MIN_ZOOM_PERCENT,
    MAX_ZOOM_PERCENT,
  );

  setZoom(zoomPercent / 100, { announce: true });
}

function getZoomStep(currentZoom) {
  const zoomPercent = currentZoom * 100;
  if (zoomPercent < 100) {
    return 0.05;
  }
  if (zoomPercent < 300) {
    return 0.1;
  }
  return 0.25;
}

function nudgeZoom(direction) {
  const currentZoom = state.view.zoom || 1;
  const step = getZoomStep(currentZoom);
  const normalizedDirection = direction < 0 ? -1 : 1;
  setZoom(currentZoom + step * normalizedDirection, { announce: true });
}

function resetZoom(announce = false) {
  state.view.panX = 0.5;
  state.view.panY = 0.5;
  const sample = getCurrentSample();
  if (sample) {
    sample.panX = 0.5;
    sample.panY = 0.5;
  }
  setZoom(1, { announce });
}

function applyTemplateToAll() {
  if (!state.samples.length) {
    setStatus("请先导入图片。", "error");
    return;
  }

  const template = elements.templateInput.value.trim() || "{stem}";
  state.samples.forEach((sample, index) => {
    sample.name = formatTemplate(template, sample, index + 1);
  });

  renderSampleTable();
  const currentSample = getCurrentSample();
  if (currentSample) {
    elements.sampleNameInput.value = currentSample.name;
    elements.viewerTitle.textContent = currentSample.name;
  }
  setStatus("批量命名已应用到全部样品。");
}

function formatTemplate(template, sample, index) {
  return template
    .replaceAll("{index}", String(index).padStart(3, "0"))
    .replaceAll("{stem}", sample.stem)
    .replaceAll("{ext}", sample.ext || "");
}

function saveCurrentSampleName() {
  const sample = getCurrentSample();
  if (!sample) {
    setStatus("请先选择一张图片。", "error");
    return;
  }

  const value = elements.sampleNameInput.value.trim();
  sample.name = value || sample.stem;
  elements.viewerTitle.textContent = sample.name;
  renderSampleTable();
  setStatus(`已更新样品名：${sample.name}`);
}

function clearCurrentRoi() {
  const sample = getCurrentSample();
  const roi = getCurrentRoi(sample);
  if (!sample || !roi) {
    setStatus("当前没有可删除的 ROI。", "error");
    return;
  }

  const deletedIndex = getRoiIndex(sample, roi.id);
  sample.rois = sample.rois.filter((item) => item.id !== roi.id);
  sample.selectedRoiId = sample.rois.length ? sample.rois[sample.rois.length - 1].id : null;
  renderSampleTable();
  updateMetaPanels();
  drawViewer();
  setStatus(`已删除 ROI ${deletedIndex}。`);
}

function copyCurrentRoiToAll() {
  const sourceSample = getCurrentSample();
  const sourceRoi = getCurrentRoi(sourceSample);
  if (!sourceSample || !sourceRoi) {
    setStatus("请先选中一个 ROI 再复制。", "error");
    return;
  }

  for (const target of state.samples) {
    if (target.id === sourceSample.id) {
      continue;
    }

    const clonedRoi = cloneRoiState(sourceRoi);
    clonedRoi.id = state.nextRoiId++;
    clonedRoi.metrics = null;
    clonedRoi.metricsKey = "";
    target.rois.push(clonedRoi);
    if (!target.selectedRoiId) {
      target.selectedRoiId = target.rois[target.rois.length - 1].id;
    }
  }

  renderSampleTable();
  updateMetaPanels();
  drawViewer();
  setStatus("已把当前 ROI 复制到其他图片。");
}

async function autoMeasureRoi(sample, roi) {
  if (!sample || !roi || roi.metrics) {
    return;
  }

  const currentSample = getCurrentSample();
  const isCurrentSample = currentSample?.id === sample.id;

  try {
    if (isCurrentSample) {
      setStatus(`正在自动计算 ${sample.name} 的 ROI ${getRoiIndex(sample, roi.id)} Lab...`, "busy");
    }

    const keepCurrent = state.currentRaster?.sampleId === sample.id;
    roi.metrics = await computeMetricsForRoi(sample, roi, keepCurrent);
    renderSampleTable();

    if (getCurrentSample()?.id === sample.id) {
      updateMetaPanels();
      drawViewer();
      setStatus(`已自动完成 ${sample.name} 的 ROI ${getRoiIndex(sample, roi.id)} Lab 统计。`);
    }
  } catch (error) {
    renderSampleTable();
    if (getCurrentSample()?.id === sample.id) {
      updateMetaPanels();
      drawViewer();
    }
    setStatus(error.message, "error");
  }
}

async function measureCurrentRoi() {
  const sample = getCurrentSample();
  const roi = getCurrentRoi(sample);
  if (!sample || !roi) {
    setStatus("请先手动绘制并选中 ROI。", "error");
    return;
  }

  try {
    setStatus(
      `正在计算 ${sample.name} 的 ROI ${getRoiIndex(sample, roi.id)} Lab...`,
      "busy",
    );
    roi.metrics = await computeMetricsForRoi(sample, roi, true);
    renderSampleTable();
    updateMetaPanels();
    drawViewer();
    setStatus(`已完成 ${sample.name} 的 ROI ${getRoiIndex(sample, roi.id)} Lab 统计。`);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function computeMetricsForRoi(sample, roi, keepCurrent = false) {
  const sampleStep = Math.max(1, Number(elements.sampleStepInput.value || 1));
  const cacheKey = buildRoiCacheKey(roi, sampleStep);
  if (roi.metrics && roi.metricsKey === cacheKey) {
    return roi.metrics;
  }

  const raster = await ensureRaster(sample, keepCurrent);
  const metrics = computeLabMetrics(raster, roi, sampleStep);
  roi.metricsKey = cacheKey;
  roi.metrics = metrics;

  if (!keepCurrent) {
    releaseRaster(raster);
  } else {
    updateViewMetrics(raster);
    drawViewer();
  }

  return metrics;
}

function buildRoiCacheKey(roi, sampleStep) {
  const pointText = Array.isArray(roi.points)
    ? roi.points.map((point) => `${point.x}:${point.y}`).join("|")
    : "";
  return `${getRoiShape(roi)}|${roi.x},${roi.y},${roi.w},${roi.h}|${pointText}|${sampleStep}`;
}

function computeLabMetrics(raster, roi, sampleStep) {
  const { width, imageData } = raster;
  const data = imageData.data;
  const left = Math.max(0, Math.floor(roi.x));
  const top = Math.max(0, Math.floor(roi.y));
  const right = Math.min(raster.width, Math.ceil(roi.x + roi.w));
  const bottom = Math.min(raster.height, Math.ceil(roi.y + roi.h));

  const stats = {
    count: 0,
    L_mean: 0,
    a_mean: 0,
    b_mean: 0,
    L_m2: 0,
    a_m2: 0,
    b_m2: 0,
  };

  for (let y = top; y < bottom; y += sampleStep) {
    for (let x = left; x < right; x += sampleStep) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] === 0) {
        continue;
      }
      if (!isPointInRoi(x + 0.5, y + 0.5, roi)) {
        continue;
      }

      const lab = rgbToLab(data[idx], data[idx + 1], data[idx + 2]);
      updateRunningMetric(stats, lab[0], lab[1], lab[2]);
    }
  }

  if (!stats.count) {
    throw new Error("ROI 内没有可用像素。");
  }

  return {
    pixels: stats.count,
    sample_step: sampleStep,
    L_mean: stats.L_mean,
    a_mean: stats.a_mean,
    b_mean: stats.b_mean,
    L_std: stats.count > 1 ? Math.sqrt(stats.L_m2 / (stats.count - 1)) : 0,
    a_std: stats.count > 1 ? Math.sqrt(stats.a_m2 / (stats.count - 1)) : 0,
    b_std: stats.count > 1 ? Math.sqrt(stats.b_m2 / (stats.count - 1)) : 0,
  };
}

function updateRunningMetric(stats, L, a, b) {
  stats.count += 1;

  const dL = L - stats.L_mean;
  stats.L_mean += dL / stats.count;
  stats.L_m2 += dL * (L - stats.L_mean);

  const da = a - stats.a_mean;
  stats.a_mean += da / stats.count;
  stats.a_m2 += da * (a - stats.a_mean);

  const db = b - stats.b_mean;
  stats.b_mean += db / stats.count;
  stats.b_m2 += db * (b - stats.b_mean);
}

function rgbToLab(r8, g8, b8) {
  const srgbToLinear = (value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };

  const r = srgbToLinear(r8);
  const g = srgbToLinear(g8);
  const b = srgbToLinear(b8);

  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  const xr = x / 0.95047;
  const yr = y / 1.0;
  const zr = z / 1.08883;

  const f = (t) =>
    t > 0.008856451679035631
      ? Math.cbrt(t)
      : (903.2962962962963 * t + 16) / 116;

  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

async function exportCsv() {
  if (!state.samples.length) {
    setStatus("请先导入图片。", "error");
    return;
  }

  const rows = [];
  const currentSample = getCurrentSample();
  const currentId = currentSample?.id || null;

  setStatus("正在整理全部样品并导出 CSV...", "busy");

  for (const sample of state.samples) {
    if (!sample.rois.length) {
        rows.push({
          sample_name: sample.name,
          roi_name: "",
          roi_index: "",
          roi_shape: "",
          roi_points: "",
          file_name: sample.file.name,
          relative_path: sample.relativePath,
        roi_x: "",
        roi_y: "",
        roi_width: "",
        roi_height: "",
        L_mean: "",
        a_mean: "",
        b_mean: "",
        L_std: "",
        a_std: "",
        b_std: "",
        pixels: "",
        sample_step: "",
        error: "未设置 ROI",
      });
      continue;
    }

    for (const roi of sample.rois) {
      try {
        const keep = sample.id === currentId;
        roi.metrics = await computeMetricsForRoi(sample, roi, keep);
        rows.push({
          sample_name: sample.name,
          roi_name: getRoiEntryName(sample, roi.id),
          roi_index: getRoiIndex(sample, roi.id),
          roi_shape: getRoiShapeLabel(roi),
          roi_points: serializeRoiPoints(roi),
          file_name: sample.file.name,
          relative_path: sample.relativePath,
          roi_x: roi.x,
          roi_y: roi.y,
          roi_width: roi.w,
          roi_height: roi.h,
          L_mean: roi.metrics.L_mean.toFixed(4),
          a_mean: roi.metrics.a_mean.toFixed(4),
          b_mean: roi.metrics.b_mean.toFixed(4),
          L_std: roi.metrics.L_std.toFixed(4),
          a_std: roi.metrics.a_std.toFixed(4),
          b_std: roi.metrics.b_std.toFixed(4),
          pixels: roi.metrics.pixels,
          sample_step: roi.metrics.sample_step,
          error: "",
        });
      } catch (error) {
        rows.push({
          sample_name: sample.name,
          roi_name: getRoiEntryName(sample, roi.id),
          roi_index: getRoiIndex(sample, roi.id),
          roi_shape: getRoiShapeLabel(roi),
          roi_points: serializeRoiPoints(roi),
          file_name: sample.file.name,
          relative_path: sample.relativePath,
          roi_x: roi.x,
          roi_y: roi.y,
          roi_width: roi.w,
          roi_height: roi.h,
          L_mean: "",
          a_mean: "",
          b_mean: "",
          L_std: "",
          a_std: "",
          b_std: "",
          pixels: "",
          sample_step: "",
          error: error.message,
        });
      }
    }
  }

  renderSampleTable();
  updateMetaPanels();
  drawViewer();
  downloadCsv(rows, "roi_lab_results.csv");
  setStatus("CSV 已导出，可以直接用 Excel 打开。");
}

function serializeRoiPoints(roi) {
  if (getRoiShape(roi) !== ROI_SHAPES.LASSO || !Array.isArray(roi.points) || !roi.points.length) {
    return "";
  }
  return roi.points.map((point) => `${point.x}:${point.y}`).join("|");
}

function downloadCsv(rows, fileName) {
  const columns = [
    "sample_name",
    "roi_name",
    "roi_index",
    "roi_shape",
    "roi_points",
    "file_name",
    "relative_path",
    "roi_x",
    "roi_y",
    "roi_width",
    "roi_height",
    "L_mean",
    "a_mean",
    "b_mean",
    "L_std",
    "a_std",
    "b_std",
    "pixels",
    "sample_step",
    "error",
  ];

  const lines = [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeCsvValue(row[column] ?? "")).join(","),
    ),
  ];

  const content = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

/* function updateMetaPanels() {
  const sample = getCurrentSample();
  const raster = state.currentRaster;
  const roi = getCurrentRoi(sample);

  if (!sample) {
    elements.viewerTitle.textContent = "还没有导入图片";
    elements.imageMeta.innerHTML =
      "<div>尺寸：-</div><div>ROI 总数：-</div><div>当前 ROI：-</div><div>文件：-</div><div>缩放：100%</div>";
    elements.labMeta.innerHTML =
      "<div>L*: -</div><div>a*: -</div><div>b*: -</div><div>像素数：-</div>";
    return;
  }

  elements.viewerTitle.textContent = sample.name || sample.file.name;
  elements.imageMeta.innerHTML = `
    <div>尺寸：${raster ? `${raster.width} × ${raster.height}` : "-"}</div>
    <div>ROI 总数：${sample.rois.length}</div>
    <div>当前 ROI：${roi ? `ROI ${getRoiIndex(sample, roi.id)}` : "-"}</div>
    <div>文件：${escapeHtml(sample.relativePath)}</div>
    <div>缩放：${Math.round(state.view.zoom * 100)}%</div>
  `;

  if (roi) {
    elements.imageMeta.innerHTML += `
      <div>条目名：${escapeHtml(getRoiEntryName(sample, roi.id))}</div>
      <div>位置：x ${roi.x}, y ${roi.y}, w ${roi.w}, h ${roi.h}</div>
    `;
  }

  if (roi?.metrics) {
    elements.labMeta.innerHTML = `
      <div>L*: ${roi.metrics.L_mean.toFixed(3)} ± ${roi.metrics.L_std.toFixed(3)}</div>
      <div>a*: ${roi.metrics.a_mean.toFixed(3)} ± ${roi.metrics.a_std.toFixed(3)}</div>
      <div>b*: ${roi.metrics.b_mean.toFixed(3)} ± ${roi.metrics.b_std.toFixed(3)}</div>
      <div>像素数：${roi.metrics.pixels}（步长 ${roi.metrics.sample_step}）</div>
    `;
  } else {
    elements.labMeta.innerHTML =
      "<div>L*: -</div><div>a*: -</div><div>b*: -</div><div>像素数：-</div>";
  }
}

*/

function updateMetaPanels() {
  const sample = getCurrentSample();
  const raster = state.currentRaster;
  const roi = getCurrentRoi(sample);

  if (!sample) {
    elements.viewerTitle.textContent = "还没有导入图片";
    elements.imageMeta.innerHTML =
      "<div>尺寸：-</div><div>ROI 总数：-</div><div>当前 ROI：-</div><div>文件：-</div><div>缩放：100%</div>";
    elements.labMeta.innerHTML = "<div>L*: -</div><div>a*: -</div><div>b*: -</div><div>像素数：-</div>";
    return;
  }

  elements.viewerTitle.textContent = sample.name || sample.file.name;
  elements.imageMeta.innerHTML = `
    <div>尺寸：${raster ? `${raster.width} × ${raster.height}` : "-"}</div>
    <div>ROI 总数：${sample.rois.length}</div>
    <div>当前 ROI：${roi ? `ROI ${getRoiIndex(sample, roi.id)}` : "-"}</div>
    <div>文件：${escapeHtml(sample.relativePath)}</div>
    <div>缩放：${Math.round(state.view.zoom * 100)}%</div>
  `;

  if (roi) {
    elements.imageMeta.innerHTML += `
      <div>条目名：${escapeHtml(getRoiEntryName(sample, roi.id))}</div>
      <div>形状：${escapeHtml(getRoiShapeLabel(roi))}</div>
      <div>位置：x ${roi.x}, y ${roi.y}, w ${roi.w}, h ${roi.h}</div>
    `;
  }

  if (roi?.metrics) {
    elements.labMeta.innerHTML = `
      <div>L*: ${roi.metrics.L_mean.toFixed(3)} ± ${roi.metrics.L_std.toFixed(3)}</div>
      <div>a*: ${roi.metrics.a_mean.toFixed(3)} ± ${roi.metrics.a_std.toFixed(3)}</div>
      <div>b*: ${roi.metrics.b_mean.toFixed(3)} ± ${roi.metrics.b_std.toFixed(3)}</div>
      <div>像素数：${roi.metrics.pixels}（步长 ${roi.metrics.sample_step}）</div>
    `;
  } else {
    elements.labMeta.innerHTML = "<div>L*: -</div><div>a*: -</div><div>b*: -</div><div>像素数：-</div>";
  }
}

function setStatus(message, tone = "info") {
  elements.statusBox.textContent = message;
  elements.statusBox.classList.toggle("is-busy", tone === "busy");
  elements.statusBox.classList.toggle("is-error", tone === "error");
}

function getCurrentSample() {
  if (state.currentIndex < 0 || state.currentIndex >= state.samples.length) {
    return null;
  }
  return state.samples[state.currentIndex];
}

function getCurrentRoi(sample = getCurrentSample()) {
  if (!sample || !sample.rois.length) {
    return null;
  }

  return getRoiById(sample, sample.selectedRoiId) || sample.rois[sample.rois.length - 1];
}

function getRoiById(sample, roiId) {
  if (!sample || roiId == null) {
    return null;
  }
  return sample.rois.find((roi) => roi.id === roiId) || null;
}

function getRoiIndex(sample, roiId) {
  if (!sample) {
    return 0;
  }
  return sample.rois.findIndex((roi) => roi.id === roiId) + 1;
}

function getRoiEntryName(sample, roiId) {
  if (!sample || roiId == null) {
    return "";
  }
  const roiIndex = getRoiIndex(sample, roiId);
  return roiIndex > 0 ? `${sample.name}-${roiIndex}` : sample.name;
}

function getTotalRoiCount() {
  return state.samples.reduce((sum, sample) => sum + sample.rois.length, 0);
}

function clearMetricsForRoi(roi) {
  if (!roi) {
    return;
  }
  roi.metrics = null;
  roi.metricsKey = "";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
