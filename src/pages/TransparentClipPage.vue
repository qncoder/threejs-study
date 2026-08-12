<script setup>
/**
 * Unity URP「ZMJ/Transparent_Clip」— GLSL 可控版本
 * Shader 源码：
 *   src/shaders/transparentClip.vert.glsl
 *   src/shaders/transparentClip.frag.glsl
 * 材质工厂：src/transparentClipGlsl.js
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  LinearToneMapping,
  PlaneHelper,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import defaultModelUrl from '../ZF18000.glb?url'
import { CAMERA_MODES, createViewerCamera, updateViewerCameraProjection } from '../viewerCamera.js'
import { prepareLoadedModelStructure } from '../modelLoadSetup.js'
import { buildTransparentClipPlanes } from '../transparentClip.js'
import {
  applyTransparentClipGlslToModel,
  createTransparentClipSharedUniforms,
  updateTransparentClipUniforms,
} from '../transparentClipGlsl.js'

const canvasHost = ref(null)
const status = ref('正在初始化场景…')
const isLoading = ref(false)
const fileName = ref('ZF18000.glb')
const modelRoot = ref(null)

/** 对应 Unity Properties → GLSL uniforms */
const baseColor = ref('#ffffff')
const opacity = ref(0.72)
const smoothness = ref(0.5)
const normalStrength = ref(1)
const metalnessScale = ref(1)

const enableClipX = ref(true)
const enableClipY = ref(false)
const enableClipZ = ref(false)
const clipPosX = ref(0)
const clipPosY = ref(0)
const clipPosZ = ref(0)

const showGrid = ref(true)
const showClipHelper = ref(true)
const doubleSided = ref(true)

let scene
let camera
let renderer
let controls
let grid
let loader
let clipHelper
let resizeObserver
let frameId = 0
/** @type {ReturnType<typeof createTransparentClipSharedUniforms> | null} */
let sharedUniforms = null
/** @type {import('three').ShaderMaterial[]} */
let glslMaterials = []

const modelBounds = ref(null)

const hasModel = computed(() => Boolean(modelRoot.value))
const canTune = computed(() => hasModel.value && !isLoading.value)
const clipAxis = computed(() => {
  if (enableClipX.value) return 'X'
  if (enableClipY.value) return 'Y'
  if (enableClipZ.value) return 'Z'
  return 'none'
})
const activeClipAxis = computed(() => (clipAxis.value === 'none' ? '无' : clipAxis.value))
const clipRange = computed(() => {
  const box = modelBounds.value
  if (!box) {
    return { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5 }
  }
  return {
    xMin: box.min.x - 0.5,
    xMax: box.max.x + 0.5,
    yMin: box.min.y - 0.5,
    yMax: box.max.y + 0.5,
    zMin: box.min.z - 0.5,
    zMax: box.max.z + 0.5,
  }
})

onMounted(async () => {
  initViewer()
  await loadDefaultModel()
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  controls?.dispose()
  clearClipHelper()
  disposeGlslMaterials()
  renderer?.dispose()
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  scene?.clear()
})

watch(showGrid, (visible) => {
  if (grid) grid.visible = visible
})

watch(
  [
    baseColor,
    opacity,
    smoothness,
    normalStrength,
    metalnessScale,
    enableClipX,
    enableClipY,
    enableClipZ,
    clipPosX,
    clipPosY,
    clipPosZ,
    doubleSided,
    showClipHelper,
  ],
  () => {
    pushUniformsToGpu()
    updateClipHelperOnly()
  },
)

function initViewer() {
  scene = new Scene()
  scene.background = new Color('#0f172a')

  camera = createViewerCamera(CAMERA_MODES.PERSPECTIVE, {
    aspect: 1,
    position: new Vector3(8, 6, 8),
    target: new Vector3(),
  })

  renderer = new WebGLRenderer({ antialias: true })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = LinearToneMapping
  renderer.toneMappingExposure = 1.1
  // 剖切在 GLSL discard 里完成，不再依赖 clippingPlanes
  renderer.localClippingEnabled = false
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)

  grid = new GridHelper(10, 20, '#475569', '#334155')
  grid.position.y = -0.02
  scene.add(grid)

  scene.add(new AmbientLight('#fff7ed', 0.5))
  scene.add(new HemisphereLight('#f8fafc', '#334155', 0.4))
  const keyLight = new DirectionalLight('#ffffff', 0.9)
  keyLight.position.set(6, 10, 5)
  scene.add(keyLight)

  canvasHost.value?.appendChild(renderer.domElement)

  resizeObserver = new ResizeObserver(() => {
    resizeViewer()
  })
  if (canvasHost.value) {
    resizeObserver.observe(canvasHost.value)
  }

  resizeViewer()
  renderLoop()
}

async function loadDefaultModel() {
  await loadModel(defaultModelUrl, 'ZF18000.glb')
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.glb')) {
    status.value = '请选择 .glb 文件。'
    event.target.value = ''
    return
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    await loadModel(objectUrl, file.name)
  } finally {
    URL.revokeObjectURL(objectUrl)
    event.target.value = ''
  }
}

async function loadModel(url, name) {
  loader ??= new GLTFLoader()
  isLoading.value = true
  status.value = `正在加载模型：${name}`

  try {
    const gltf = await loader.loadAsync(url)
    replaceModel(gltf.scene, name)
  } catch (error) {
    status.value = `模型加载失败：${error.message}`
    modelRoot.value = null
  } finally {
    isLoading.value = false
  }
}

function disposeGlslMaterials() {
  for (const material of glslMaterials) {
    material.dispose?.()
  }
  glslMaterials = []
  sharedUniforms = null
}

function replaceModel(nextModel, name) {
  if (modelRoot.value) {
    scene.remove(modelRoot.value)
  }
  disposeGlslMaterials()

  prepareLoadedModelStructure(nextModel)
  nextModel.updateWorldMatrix(true, true)

  // 先放进场景再换材质：贴图仍来自原 GLB material
  scene.add(nextModel)
  modelRoot.value = nextModel
  fileName.value = name

  sharedUniforms = createTransparentClipSharedUniforms({
    baseColor: baseColor.value,
    opacity: opacity.value,
    smoothness: smoothness.value,
    normalStrength: normalStrength.value,
    metalnessScale: metalnessScale.value,
    enableClipX: enableClipX.value,
    enableClipY: enableClipY.value,
    enableClipZ: enableClipZ.value,
    clipPosX: clipPosX.value,
    clipPosY: clipPosY.value,
    clipPosZ: clipPosZ.value,
  })

  const applied = applyTransparentClipGlslToModel(nextModel, sharedUniforms)
  glslMaterials = applied.materials

  fitCameraToModel(nextModel)
  initClipFromBounds(nextModel)
  pushUniformsToGpu()
  updateClipHelperOnly()

  status.value = `GLSL Shader 已挂上：${name}（vert/frag 控制透明与剖切）`
}

function pushUniformsToGpu() {
  if (!sharedUniforms) return
  updateTransparentClipUniforms(sharedUniforms, {
    baseColor: baseColor.value,
    opacity: opacity.value,
    smoothness: smoothness.value,
    normalStrength: normalStrength.value,
    metalnessScale: metalnessScale.value,
    clipAxis: clipAxis.value,
    clipPosX: clipPosX.value,
    clipPosY: clipPosY.value,
    clipPosZ: clipPosZ.value,
    doubleSided: doubleSided.value,
    materials: glslMaterials,
  })
}

function updateClipHelperOnly() {
  clearClipHelper()
  if (!showClipHelper.value || !modelBounds.value) return

  const planes = buildTransparentClipPlanes({
    enableClipX: enableClipX.value,
    enableClipY: enableClipY.value,
    enableClipZ: enableClipZ.value,
    clipPosX: clipPosX.value,
    clipPosY: clipPosY.value,
    clipPosZ: clipPosZ.value,
  })
  if (planes.length === 0) return

  const size = modelBounds.value.getSize(new Vector3())
  const helperSize = Math.max(size.x, size.y, size.z, 1) * 1.2
  clipHelper = new PlaneHelper(planes[0], helperSize, 0x38bdf8)
  clipHelper.name = 'TransparentClipHelper'
  scene.add(clipHelper)
}

function clearClipHelper() {
  if (!clipHelper) return
  scene?.remove(clipHelper)
  clipHelper.geometry?.dispose?.()
  clipHelper.material?.dispose?.()
  clipHelper = null
}

function initClipFromBounds(model) {
  const box = new Box3().setFromObject(model)
  if (box.isEmpty()) {
    modelBounds.value = null
    return
  }
  modelBounds.value = box.clone()
  const center = box.getCenter(new Vector3())
  clipPosX.value = Number(center.x.toFixed(3))
  clipPosY.value = Number(center.y.toFixed(3))
  clipPosZ.value = Number(center.z.toFixed(3))
}

function setClipAxis(axis) {
  enableClipX.value = axis === 'X'
  enableClipY.value = axis === 'Y'
  enableClipZ.value = axis === 'Z'
}

function disableClip() {
  enableClipX.value = false
  enableClipY.value = false
  enableClipZ.value = false
}

function handleReset() {
  baseColor.value = '#ffffff'
  opacity.value = 0.72
  smoothness.value = 0.5
  normalStrength.value = 1
  metalnessScale.value = 1
  doubleSided.value = true
  showClipHelper.value = true
  if (modelRoot.value) {
    initClipFromBounds(modelRoot.value)
  }
  setClipAxis('X')
  pushUniformsToGpu()
  updateClipHelperOnly()
  status.value = '已恢复默认，uniforms 已写回 GLSL。'
}

function fitCameraToModel(model) {
  const box = new Box3().setFromObject(model)
  if (box.isEmpty()) return

  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  const maxSize = Math.max(size.x, size.y, size.z) || 1
  const distance = maxSize * 2.1

  camera.near = Math.max(distance / 200, 0.01)
  camera.far = distance * 100
  camera.position.set(center.x + distance, center.y + distance * 0.65, center.z + distance)
  camera.lookAt(center)

  updateViewerCameraProjection(camera, {
    width: canvasHost.value?.clientWidth,
    height: canvasHost.value?.clientHeight,
    target: center,
  })

  controls.target.copy(center)
  controls.update()

  grid.scale.setScalar(Math.max(maxSize / 5, 1))
  grid.position.y = box.min.y - maxSize * 0.02
}

function resizeViewer() {
  if (!canvasHost.value || !renderer || !camera) return

  const width = Math.max(canvasHost.value.clientWidth, 1)
  const height = Math.max(canvasHost.value.clientHeight, 1)

  renderer.setSize(width, height, false)
  updateViewerCameraProjection(camera, {
    width,
    height,
    target: controls?.target ?? new Vector3(),
  })
}

function renderLoop() {
  frameId = requestAnimationFrame(renderLoop)
  controls?.update()
  renderer?.render(scene, camera)
}
</script>

<template>
  <main class="debug-page">
    <header class="debug-header">
      <div>
        <p class="debug-eyebrow">GLSL ShaderMaterial</p>
        <h1>Transparent_Clip</h1>
      </div>
      <div class="debug-header-actions">
        <RouterLink class="header-link" to="/">返回编辑器</RouterLink>
        <RouterLink class="header-link" to="/zf18000-metal-hdr">HDR 金属</RouterLink>
        <label class="file-picker">
          <span>更换 GLB</span>
          <input type="file" accept=".glb,model/gltf-binary" @change="handleFileChange" />
        </label>
      </div>
    </header>

    <section class="debug-content">
      <div class="viewer-surface">
        <div ref="canvasHost" class="canvas-host" aria-label="Transparent_Clip GLSL 预览"></div>
      </div>

      <aside class="control-panel">
        <section class="panel-section">
          <h2>Shader 源码位置</h2>
          <ul class="hint-list">
            <li><code>src/shaders/transparentClip.vert.glsl</code></li>
            <li><code>src/shaders/transparentClip.frag.glsl</code></li>
            <li>工厂：<code>src/transparentClipGlsl.js</code></li>
          </ul>
          <dl class="info-list">
            <div>
              <dt>模型</dt>
              <dd>{{ fileName }}</dd>
            </div>
            <div>
              <dt>剖切轴</dt>
              <dd>{{ activeClipAxis }}</dd>
            </div>
            <div>
              <dt>控制方式</dt>
              <dd>GLSL uniform + discard</dd>
            </div>
          </dl>
          <p class="status-line" :class="{ loading: isLoading }">{{ status }}</p>
        </section>

        <section class="panel-section">
          <h2>uniform 表面参数</h2>
          <label class="field-row">
            <span>uBaseColor</span>
            <input v-model="baseColor" type="color" :disabled="!canTune" />
          </label>
          <div class="slider-block">
            <div class="slider-label">
              <span>uOpacity</span>
              <strong>{{ opacity.toFixed(2) }}</strong>
            </div>
            <input v-model.number="opacity" type="range" min="0.05" max="1" step="0.01" :disabled="!canTune" />
          </div>
          <div class="slider-block">
            <div class="slider-label">
              <span>uSmoothness</span>
              <strong>{{ smoothness.toFixed(2) }}</strong>
            </div>
            <input v-model.number="smoothness" type="range" min="0" max="1" step="0.01" :disabled="!canTune" />
          </div>
          <div class="slider-block">
            <div class="slider-label">
              <span>uMetalnessScale</span>
              <strong>{{ metalnessScale.toFixed(2) }}</strong>
            </div>
            <input v-model.number="metalnessScale" type="range" min="0" max="2" step="0.01" :disabled="!canTune" />
          </div>
          <div class="slider-block">
            <div class="slider-label">
              <span>uNormalStrength</span>
              <strong>{{ normalStrength.toFixed(2) }}</strong>
            </div>
            <input v-model.number="normalStrength" type="range" min="0" max="2" step="0.01" :disabled="!canTune" />
          </div>
          <label class="toggle-row">
            <input v-model="doubleSided" type="checkbox" :disabled="!canTune" />
            <span>双面（material.side）</span>
          </label>
        </section>

        <section class="panel-section">
          <h2>GLSL 世界空间 Clip</h2>
          <p class="hint-text">
            片元里：<code>if (vWorldPosition.x &lt; uClipPosX) discard</code>（三轴 else-if 互斥）。
          </p>
          <div class="button-row axis-row">
            <button type="button" :class="{ active: enableClipX }" :disabled="!canTune" @click="setClipAxis('X')">
              Clip X
            </button>
            <button type="button" :class="{ active: enableClipY }" :disabled="!canTune" @click="setClipAxis('Y')">
              Clip Y
            </button>
            <button type="button" :class="{ active: enableClipZ }" :disabled="!canTune" @click="setClipAxis('Z')">
              Clip Z
            </button>
            <button type="button" :disabled="!canTune" @click="disableClip">关闭</button>
          </div>

          <div class="slider-block">
            <div class="slider-label">
              <span>uClipPosX</span>
              <strong>{{ clipPosX.toFixed(3) }}</strong>
            </div>
            <input
              v-model.number="clipPosX"
              type="range"
              :min="clipRange.xMin"
              :max="clipRange.xMax"
              step="0.01"
              :disabled="!canTune || !enableClipX"
            />
          </div>
          <div class="slider-block">
            <div class="slider-label">
              <span>uClipPosY</span>
              <strong>{{ clipPosY.toFixed(3) }}</strong>
            </div>
            <input
              v-model.number="clipPosY"
              type="range"
              :min="clipRange.yMin"
              :max="clipRange.yMax"
              step="0.01"
              :disabled="!canTune || !enableClipY"
            />
          </div>
          <div class="slider-block">
            <div class="slider-label">
              <span>uClipPosZ</span>
              <strong>{{ clipPosZ.toFixed(3) }}</strong>
            </div>
            <input
              v-model.number="clipPosZ"
              type="range"
              :min="clipRange.zMin"
              :max="clipRange.zMax"
              step="0.01"
              :disabled="!canTune || !enableClipZ"
            />
          </div>

          <label class="toggle-row">
            <input v-model="showClipHelper" type="checkbox" :disabled="!canTune" />
            <span>显示剖切辅助面（仅可视化）</span>
          </label>
          <label class="toggle-row">
            <input v-model="showGrid" type="checkbox" />
            <span>显示网格</span>
          </label>
          <div class="button-row">
            <button type="button" :disabled="!canTune" @click="handleReset">恢复默认</button>
          </div>
        </section>

        <section class="panel-section">
          <h2>数据流</h2>
          <ul class="hint-list">
            <li>UI 滑条 → <code>updateTransparentClipUniforms</code></li>
            <li>→ <code>ShaderMaterial.uniforms</code></li>
            <li>→ GPU 跑 <code>.vert.glsl</code> / <code>.frag.glsl</code></li>
            <li>贴图来自 GLB 原材质 map / metalnessMap / normalMap</li>
          </ul>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.debug-page {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}

.debug-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #334155;
  background: #111827;
}

.debug-eyebrow {
  margin: 0 0 6px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}

.debug-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
}

.debug-header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.header-link,
.file-picker,
.button-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.header-link:hover,
.file-picker:hover,
.button-row button:hover:not(:disabled) {
  background: #334155;
}

.button-row button.active {
  border-color: #38bdf8;
  background: #0c4a6e;
  color: #e0f2fe;
}

.button-row button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.file-picker {
  position: relative;
  overflow: hidden;
}

.file-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.debug-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  min-height: 0;
}

.viewer-surface {
  min-height: 0;
  padding: 20px 20px 20px 24px;
}

.canvas-host {
  width: 100%;
  height: calc(100vh - 118px);
  min-height: 520px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #020617;
  overflow: hidden;
}

.control-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 20px 24px 24px 0;
}

.panel-section {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #111827;
}

.panel-section h2 {
  margin: 0;
  font-size: 15px;
  color: #f8fafc;
}

.info-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

.info-list div {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 10px;
}

.info-list dt {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
}

.info-list dd {
  margin: 0;
  word-break: break-all;
  font-size: 13px;
}

.status-line {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: #0f172a;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.45;
}

.status-line.loading {
  color: #fbbf24;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: #e2e8f0;
}

.field-row input[type='color'] {
  width: 48px;
  height: 32px;
  border: 1px solid #475569;
  border-radius: 4px;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #e2e8f0;
  cursor: pointer;
}

.slider-block {
  display: grid;
  gap: 6px;
}

.slider-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: #cbd5e1;
}

.slider-block input[type='range'] {
  width: 100%;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.axis-row button {
  min-width: 64px;
}

.hint-text,
.hint-list {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.55;
}

.hint-list {
  padding-left: 18px;
}

.hint-text code,
.hint-list code {
  color: #93c5fd;
  font-size: 11px;
}

@media (max-width: 1100px) {
  .debug-content {
    grid-template-columns: 1fr;
  }

  .control-panel {
    padding: 0 24px 24px;
  }

  .canvas-host {
    height: 56vh;
    min-height: 360px;
  }
}
</style>
