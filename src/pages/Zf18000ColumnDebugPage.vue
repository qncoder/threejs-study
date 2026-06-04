<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  LinearToneMapping,
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
import {
  applyColumnHeight,
  createColumnMotionState,
  resetColumnHeight,
} from '../zf18000ColumnMotion.js'

const canvasHost = ref(null)
const status = ref('正在加载默认模型 ZF18000.glb')
const isLoading = ref(false)
const fileName = ref('ZF18000.glb')
const progress = ref(0)
const missingNodes = ref([])
const stageRows = ref([])
const modelRoot = ref(null)
const motionState = ref(null)

let scene
let camera
let renderer
let controls
let grid
let loader
let resizeObserver
let frameId = 0

const progressText = computed(() => `${Math.round(progress.value * 100)}%`)
const hasModel = computed(() => Boolean(modelRoot.value))
const canControl = computed(() => hasModel.value && Boolean(motionState.value) && !isLoading.value)

onMounted(() => {
  initViewer()
  loadDefaultModel()
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  controls?.dispose()
  renderer?.dispose()
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  scene?.clear()
})

function initViewer() {
  scene = new Scene()
  scene.background = new Color('#f5f5f4')

  camera = createViewerCamera(CAMERA_MODES.PERSPECTIVE, {
    aspect: 1,
    position: new Vector3(8, 6, 8),
    target: new Vector3(),
  })

  renderer = new WebGLRenderer({ antialias: true })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = LinearToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)

  grid = new GridHelper(10, 10, 0xd6d3d1, 0xe7e5e4)
  scene.add(grid)
  scene.add(new AmbientLight(0xffffff, 1.3))
  scene.add(new HemisphereLight(0xffffff, 0xd6d3d1, 0.9))

  const keyLight = new DirectionalLight(0xffffff, 1.2)
  keyLight.position.set(8, 10, 6)
  scene.add(keyLight)

  const fillLight = new DirectionalLight(0xffffff, 0.6)
  fillLight.position.set(-6, 5, -4)
  scene.add(fillLight)

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
    motionState.value = null
    missingNodes.value = []
    stageRows.value = []
  } finally {
    isLoading.value = false
  }
}

function replaceModel(nextModel, name) {
  if (modelRoot.value) {
    scene.remove(modelRoot.value)
  }

  prepareLoadedModelStructure(nextModel)
  nextModel.updateWorldMatrix(true, true)
  scene.add(nextModel)

  modelRoot.value = nextModel
  fileName.value = name
  progress.value = 0
  fitCameraToModel(nextModel)

  const stateResult = createColumnMotionState(nextModel)
  if (!stateResult.ok) {
    motionState.value = null
    missingNodes.value = stateResult.missing ?? []
    stageRows.value = []
    status.value = stateResult.error
    return
  }

  motionState.value = stateResult.state
  missingNodes.value = []
  applyHeightProgress(0, true)
}

function applyHeightProgress(nextProgress = progress.value, silent = false) {
  if (!modelRoot.value || !motionState.value) return

  console.log('~applyColumnHeight:', nextProgress);
  const result = applyColumnHeight(modelRoot.value, motionState.value, nextProgress)
  if (!result.ok) {
    status.value = result.error
    return
  }

  progress.value = result.progress
  stageRows.value = result.applied.map((column) => ({
    ...column,
    stage1Text: column.stage1.toFixed(3),
    stage2Text: column.stage2.toFixed(3),
  }))

  if (!silent) {
    status.value = `已应用立柱高度：${Math.round(result.progress * 100)}%`
  } else {
    status.value = `模型已就绪：${fileName.value}`
  }
}

function handleProgressInput() {
  applyHeightProgress(progress.value)
}

function handleReset() {
  if (!modelRoot.value || !motionState.value) return

  const result = resetColumnHeight(modelRoot.value, motionState.value)
  if (!result.ok) {
    status.value = result.error
    return
  }

  progress.value = 0
  stageRows.value = result.applied.map((column) => ({
    ...column,
    stage1Text: column.stage1.toFixed(3),
    stage2Text: column.stage2.toFixed(3),
  }))
  status.value = '已恢复到初始姿态。'
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
        <p class="debug-eyebrow">ZF18000</p>
        <h1>前后立柱高度调试</h1>
      </div>
      <div class="debug-header-actions">
        <RouterLink class="header-link" to="/">返回编辑器</RouterLink>
        <label class="file-picker">
          <span>更换 GLB</span>
          <input type="file" accept=".glb,model/gltf-binary" @change="handleFileChange" />
        </label>
      </div>
    </header>

    <section class="debug-content">
      <div class="viewer-surface">
        <div ref="canvasHost" class="canvas-host" aria-label="ZF18000 立柱调试预览"></div>
      </div>

      <aside class="control-panel">
        <section class="panel-section">
          <h2>当前模型</h2>
          <dl class="info-list">
            <div>
              <dt>文件名</dt>
              <dd>{{ fileName }}</dd>
            </div>
            <div>
              <dt>高度进度</dt>
              <dd>{{ progressText }}</dd>
            </div>
            <div>
              <dt>验证脚本</dt>
              <dd>script/ZF18000ColumnHeight/run.js</dd>
            </div>
          </dl>
          <p class="status-line" :class="{ loading: isLoading }">{{ status }}</p>
        </section>

        <section class="panel-section">
          <h2>高度控制</h2>
          <div class="slider-row">
            <span>-100%</span>
            <input
              v-model.number="progress"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              :disabled="!canControl"
              @input="handleProgressInput"
            />
            <span>100%</span>
          </div>
          <div class="button-row">
            <button type="button" :disabled="!canControl" @click="handleReset">重置高度</button>
          </div>
          <p class="hint-text">滑条只驱动前后立柱两段油缸，用来验证方向和冲程是否正确。</p>
        </section>

        <section class="panel-section">
          <h2>冲程明细</h2>
          <ul v-if="stageRows.length > 0" class="stage-list">
            <li v-for="row in stageRows" :key="row.key">
              <strong>{{ row.label }}</strong>
              <span>第一段 {{ row.stage1Text }}</span>
              <span>第二段 {{ row.stage2Text }}</span>
            </li>
          </ul>
          <p v-else class="empty-text">模型加载后会显示当前前后立柱的两段冲程。</p>
        </section>

        <section class="panel-section">
          <h2>节点检查</h2>
          <ul v-if="missingNodes.length > 0" class="missing-list">
            <li v-for="name in missingNodes" :key="name">{{ name }}</li>
          </ul>
          <p v-else class="empty-text">前后立柱必需节点已找到，可以直接拖动滑条调试。</p>
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
  background: #f5f5f4;
  color: #1c1917;
}

.debug-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #d6d3d1;
  background: #fafaf9;
}

.debug-eyebrow {
  margin: 0 0 6px;
  color: #57534e;
  font-size: 12px;
  font-weight: 700;
}

.debug-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.debug-header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.header-link,
.file-picker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #d6d3d1;
  border-radius: 6px;
  background: #ffffff;
  color: #1c1917;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.file-picker {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.file-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.debug-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
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
  border: 1px solid #d6d3d1;
  border-radius: 8px;
  background: #ffffff;
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
  border: 1px solid #d6d3d1;
  border-radius: 8px;
  background: #fafaf9;
}

.panel-section h2 {
  margin: 0;
  font-size: 15px;
}

.info-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

.info-list div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
}

.info-list dt {
  color: #57534e;
}

.info-list dd {
  margin: 0;
  word-break: break-all;
}

.status-line {
  margin: 0;
  padding: 10px 12px;
  color: #44403c;
  background: #ffffff;
  border-radius: 6px;
  line-height: 1.5;
}

.status-line.loading {
  color: #0f766e;
}

.slider-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #57534e;
}

.slider-row input {
  width: 100%;
  accent-color: #0f766e;
}

.button-row {
  display: flex;
  gap: 8px;
}

.button-row button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #d6d3d1;
  border-radius: 6px;
  background: #ffffff;
  color: #1c1917;
  font-weight: 600;
}

.button-row button:disabled {
  color: #a8a29e;
  background: #f5f5f4;
}

.hint-text,
.empty-text {
  margin: 0;
  color: #57534e;
  font-size: 12px;
  line-height: 1.6;
}

.stage-list,
.missing-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stage-list li,
.missing-list li {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #ffffff;
}

.stage-list strong {
  font-size: 13px;
}

.missing-list li {
  color: #9a3412;
  word-break: break-all;
}

@media (max-width: 1100px) {
  .debug-content {
    grid-template-columns: 1fr;
  }

  .viewer-surface {
    padding-right: 24px;
  }

  .control-panel {
    padding-left: 24px;
  }

  .canvas-host {
    height: 58vh;
    min-height: 420px;
  }
}

@media (max-width: 720px) {
  .debug-header {
    flex-direction: column;
    align-items: stretch;
  }

  .debug-header-actions {
    justify-content: flex-start;
  }

  .debug-header h1 {
    font-size: 24px;
  }

  .viewer-surface,
  .control-panel {
    padding: 16px;
  }

  .canvas-host {
    height: 48vh;
    min-height: 320px;
  }
}
</style>
