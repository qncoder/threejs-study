<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  GridHelper,
  HemisphereLight,
  LinearToneMapping,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import defaultModelUrl from '../ZF18000-white.glb?url'
import { CAMERA_MODES, createViewerCamera, updateViewerCameraProjection } from '../viewerCamera.js'
import { prepareLoadedModelStructure } from '../modelLoadSetup.js'

/** 默认 HDR：放在 public/textures/equirectangular/ */
const DEFAULT_HDR_URL = '/textures/equirectangular/quarry_01_1k.hdr'

const canvasHost = ref(null)
const status = ref('正在初始化场景…')
const isLoading = ref(false)
const fileName = ref('ZF18000-white.glb')
const hdrName = ref('quarry_01_1k.hdr')
const modelRoot = ref(null)
const hasHdr = ref(false)

const useAces = ref(true)
const exposure = ref(1.1)
const envMapIntensity = ref(1.25)
const showHdrBackground = ref(true)
const showGrid = ref(true)
const boostMetal = ref(true)
const metalnessBoost = ref(0.95)
const roughnessCap = ref(0.22)

let scene
let camera
let renderer
let controls
let grid
let loader
let rgbeLoader
let pmremGenerator
let envTexture = null
let resizeObserver
let frameId = 0
/** @type {Map<object, { metalness: number, roughness: number, envMapIntensity: number }>} */
const materialOriginals = new Map()

const hasModel = computed(() => Boolean(modelRoot.value))
const canTune = computed(() => hasModel.value && !isLoading.value)

onMounted(async () => {
  initViewer()
  await loadDefaultHdr()
  await loadDefaultModel()
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  controls?.dispose()
  disposeEnvironment()
  pmremGenerator?.dispose()
  renderer?.dispose()
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  scene?.clear()
  materialOriginals.clear()
})

watch([useAces, exposure], () => {
  applyRendererTone()
})

watch(showHdrBackground, () => {
  applyEnvironmentDisplay()
})

watch(showGrid, (visible) => {
  if (grid) grid.visible = visible
})

watch([boostMetal, metalnessBoost, roughnessCap, envMapIntensity], () => {
  applyMetalLook()
})

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  applyRendererTone()

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)

  grid = new GridHelper(10, 20, '#475569', '#334155')
  grid.position.y = -0.02
  scene.add(grid)

  // 保留少量补光，主金属反射仍靠 HDR environment
  scene.add(new AmbientLight('#fff7ed', 0.35))
  scene.add(new HemisphereLight('#f8fafc', '#334155', 0.45))

  const keyLight = new DirectionalLight('#ffffff', 1.1)
  keyLight.position.set(6, 10, 5)
  scene.add(keyLight)

  const fillLight = new DirectionalLight('#dbeafe', 0.35)
  fillLight.position.set(-6, 4, -4)
  scene.add(fillLight)

  pmremGenerator = new PMREMGenerator(renderer)
  pmremGenerator.compileEquirectangularShader()

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

function applyRendererTone() {
  if (!renderer) return
  renderer.toneMapping = useAces.value ? ACESFilmicToneMapping : LinearToneMapping
  renderer.toneMappingExposure = exposure.value
}

async function loadDefaultHdr() {
  status.value = `正在加载 HDR：${hdrName.value}`
  try {
    await applyHdrFromUrl(DEFAULT_HDR_URL, 'quarry_01_1k.hdr')
  } catch (error) {
    hasHdr.value = false
    status.value = `默认 HDR 加载失败：${error.message}。可手动选择 .hdr 文件。`
  }
}

async function applyHdrFromUrl(url, name) {
  rgbeLoader ??= new RGBELoader()
  const equirect = await rgbeLoader.loadAsync(url)
  equirect.mapping = EquirectangularReflectionMapping

  disposeEnvironment()

  // PMREM 预过滤，金属反射更稳定
  const envRT = pmremGenerator.fromEquirectangular(equirect)
  envTexture = {
    equirect,
    pmrem: envRT.texture,
    dispose() {
      equirect.dispose()
      envRT.dispose()
    },
  }

  scene.environment = envTexture.pmrem
  applyEnvironmentDisplay()
  hasHdr.value = true
  hdrName.value = name
  applyMetalLook()
  status.value = `HDR 已就绪：${name}`
}

function applyEnvironmentDisplay() {
  if (!scene) return
  if (hasHdr.value && envTexture?.equirect && showHdrBackground.value) {
    scene.background = envTexture.equirect
  } else if (!showHdrBackground.value) {
    scene.background = new Color('#0f172a')
  }
}

function disposeEnvironment() {
  if (scene) {
    scene.environment = null
    if (scene.background && scene.background.isTexture) {
      scene.background = new Color('#0f172a')
    }
  }
  envTexture?.dispose?.()
  envTexture = null
}

async function handleHdrFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.hdr') && !lower.endsWith('.pic')) {
    status.value = '请选择 .hdr 环境贴图文件。'
    event.target.value = ''
    return
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    isLoading.value = true
    status.value = `正在加载 HDR：${file.name}`
    await applyHdrFromUrl(objectUrl, file.name)
    if (modelRoot.value) {
      status.value = `HDR 已切换：${file.name}，模型 ${fileName.value}`
    }
  } catch (error) {
    status.value = `HDR 加载失败：${error.message}`
  } finally {
    isLoading.value = false
    URL.revokeObjectURL(objectUrl)
    event.target.value = ''
  }
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

function replaceModel(nextModel, name) {
  if (modelRoot.value) {
    scene.remove(modelRoot.value)
  }

  materialOriginals.clear()
  prepareLoadedModelStructure(nextModel)
  nextModel.updateWorldMatrix(true, true)
  captureMaterialOriginals(nextModel)
  scene.add(nextModel)

  modelRoot.value = nextModel
  fileName.value = name
  fitCameraToModel(nextModel)
  applyMetalLook()

  const hdrTip = hasHdr.value ? `，HDR：${hdrName.value}` : '（尚未加载 HDR）'
  status.value = `模型已就绪：${name}${hdrTip}`
}

function captureMaterialOriginals(root) {
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!material || materialOriginals.has(material)) continue
      materialOriginals.set(material, {
        metalness: material.metalness ?? 0,
        roughness: material.roughness ?? 1,
        envMapIntensity: material.envMapIntensity ?? 1,
      })
    }
  })
}

function applyMetalLook() {
  if (!modelRoot.value) return

  for (const [material, original] of materialOriginals) {
    if (boostMetal.value) {
      material.metalness = Math.max(original.metalness, metalnessBoost.value)
      material.roughness = Math.min(original.roughness, roughnessCap.value)
    } else {
      material.metalness = original.metalness
      material.roughness = original.roughness
    }
    material.envMapIntensity = envMapIntensity.value
    material.needsUpdate = true
  }
}

function handleResetMetal() {
  boostMetal.value = false
  metalnessBoost.value = 0.95
  roughnessCap.value = 0.22
  envMapIntensity.value = 1.25
  exposure.value = 1.1
  useAces.value = true
  applyMetalLook()
  applyRendererTone()
  status.value = '已恢复材质参数（关闭金属加强，保留 GLB 原始 metal/rough）。'
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
        <p class="debug-eyebrow">ZF18000 · 金属预览</p>
        <h1>HDR 环境金属质感</h1>
      </div>
      <div class="debug-header-actions">
        <RouterLink class="header-link" to="/">返回编辑器</RouterLink>
        <label class="file-picker">
          <span>更换 HDR</span>
          <input type="file" accept=".hdr,.pic,image/vnd.radiance" @change="handleHdrFileChange" />
        </label>
        <label class="file-picker">
          <span>更换 GLB</span>
          <input type="file" accept=".glb,model/gltf-binary" @change="handleFileChange" />
        </label>
      </div>
    </header>

    <section class="debug-content">
      <div class="viewer-surface">
        <div ref="canvasHost" class="canvas-host" aria-label="ZF18000 HDR 金属预览"></div>
      </div>

      <aside class="control-panel">
        <section class="panel-section">
          <h2>当前资源</h2>
          <dl class="info-list">
            <div>
              <dt>模型</dt>
              <dd>{{ fileName }}</dd>
            </div>
            <div>
              <dt>HDR</dt>
              <dd>{{ hasHdr ? hdrName : '未加载' }}</dd>
            </div>
            <div>
              <dt>色调映射</dt>
              <dd>{{ useAces ? 'ACES Filmic' : 'Linear' }}</dd>
            </div>
          </dl>
          <p class="status-line" :class="{ loading: isLoading }">{{ status }}</p>
        </section>

        <section class="panel-section">
          <h2>环境与曝光</h2>
          <label class="toggle-row">
            <input v-model="useAces" type="checkbox" />
            <span>使用 ACESFilmicToneMapping</span>
          </label>
          <label class="toggle-row">
            <input v-model="showHdrBackground" type="checkbox" :disabled="!hasHdr" />
            <span>HDR 作为背景</span>
          </label>
          <label class="toggle-row">
            <input v-model="showGrid" type="checkbox" />
            <span>显示网格</span>
          </label>
          <div class="slider-block">
            <div class="slider-label">
              <span>Exposure</span>
              <strong>{{ exposure.toFixed(2) }}</strong>
            </div>
            <input v-model.number="exposure" type="range" min="0.2" max="2.5" step="0.01" />
          </div>
          <div class="slider-block">
            <div class="slider-label">
              <span>envMapIntensity</span>
              <strong>{{ envMapIntensity.toFixed(2) }}</strong>
            </div>
            <input
              v-model.number="envMapIntensity"
              type="range"
              min="0"
              max="3"
              step="0.01"
              :disabled="!canTune"
            />
          </div>
        </section>

        <section class="panel-section">
          <h2>金属加强</h2>
          <label class="toggle-row">
            <input v-model="boostMetal" type="checkbox" :disabled="!canTune" />
            <span>抬高 metalness / 压低 roughness</span>
          </label>
          <div class="slider-block">
            <div class="slider-label">
              <span>metalness 下限</span>
              <strong>{{ metalnessBoost.toFixed(2) }}</strong>
            </div>
            <input
              v-model.number="metalnessBoost"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :disabled="!canTune || !boostMetal"
            />
          </div>
          <div class="slider-block">
            <div class="slider-label">
              <span>roughness 上限</span>
              <strong>{{ roughnessCap.toFixed(2) }}</strong>
            </div>
            <input
              v-model.number="roughnessCap"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :disabled="!canTune || !boostMetal"
            />
          </div>
          <div class="button-row">
            <button type="button" :disabled="!canTune" @click="handleResetMetal">恢复 GLB 原始金属参数</button>
          </div>
          <p class="hint-text">
            ZF18000 自带 Albedo / MetallicRoughness / Normal。金属感主要靠
            <code>scene.environment</code>（HDR）+ ACES 曝光；「金属加强」会在原贴图基础上再压粗糙度。
          </p>
        </section>

        <section class="panel-section">
          <h2>说明</h2>
          <ul class="hint-list">
            <li>默认 HDR：<code>public/textures/equirectangular/quarry_01_1k.hdr</code></li>
            <li>路由：<code>/zf18000-metal-hdr</code></li>
            <li>可本地更换 .hdr / .glb 对比效果</li>
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
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
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
