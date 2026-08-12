<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  GridHelper,
  LinearToneMapping,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import whiteModelUrl from '../ZF18000-white.glb?url'
import originalModelUrl from '../ZF18000.glb?url'
import { CAMERA_MODES, createViewerCamera, updateViewerCameraProjection } from '../viewerCamera.js'
import {
  LIGHT_PRESETS,
  applyLightConfig,
  configureLightShadow,
  createLightConfigs,
  createLightHelper,
  createLightObject,
  resolveVisibleLightIds,
  scaleLightConfig,
} from '../lightingLab.js'

const MODEL_OPTIONS = [
  { key: 'white', label: '白模（看光最准）', url: whiteModelUrl, name: 'ZF18000-white.glb' },
  { key: 'original', label: '原始材质', url: originalModelUrl, name: 'ZF18000.glb' },
]

const canvasHost = ref(null)
const status = ref('正在初始化场景…')
const isLoading = ref(false)
const modelKey = ref('white')
const modelName = ref('ZF18000-white.glb')

const lights = ref(createLightConfigs(1))
const soloId = ref(null)

const shadowsEnabled = ref(true)
const useAces = ref(true)
const exposure = ref(1)
const showGrid = ref(true)
const showGround = ref(true)
const showHelpers = ref(true)
const orbitLights = ref(false)
const orbitSpeed = ref(0.4)
const backgroundColor = ref('#0b1220')

let scene
let camera
let renderer
let controls
let loader
let grid
let ground
let modelRoot = null
let resizeObserver
let frameId = 0
let lastFrameTime = 0
let orbitAngle = 0
let modelRadius = 1
const modelCenter = new Vector3()
/** id -> { light, target, helper } */
const lightRig = new Map()

const visibleLightIds = computed(() => resolveVisibleLightIds(lights.value, soloId.value))
const activeLightLabels = computed(() => lights.value
  .filter((config) => visibleLightIds.value.has(config.id))
  .map((config) => config.label))
const soloLabel = computed(() => lights.value.find((config) => config.id === soloId.value)?.label ?? '')

onMounted(() => {
  initViewer()
  loadModel(modelKey.value)
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  controls?.dispose()
  disposeLightRig()
  ground?.geometry?.dispose()
  ground?.material?.dispose()
  grid?.dispose?.()
  renderer?.dispose()
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  scene?.clear()
})

watch(lights, () => syncLights(), { deep: true })
watch([soloId, showHelpers], () => syncLights())
watch(shadowsEnabled, () => applyShadowSetting())
watch([useAces, exposure], () => applyRendererTone())
watch(showGrid, (visible) => { if (grid) grid.visible = visible })
watch(showGround, (visible) => { if (ground) ground.visible = visible })
watch(backgroundColor, (value) => { if (scene) scene.background = new Color(value) })
watch(modelKey, (key) => loadModel(key))

function initViewer() {
  scene = new Scene()
  scene.background = new Color(backgroundColor.value)

  camera = createViewerCamera(CAMERA_MODES.PERSPECTIVE, {
    aspect: 1,
    position: new Vector3(8, 6, 8),
    target: new Vector3(),
  })

  renderer = new WebGLRenderer({ antialias: true })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = shadowsEnabled.value
  renderer.shadowMap.type = PCFSoftShadowMap
  applyRendererTone()

  // RectAreaLight 依赖预计算的 LTC 查找表，不初始化就完全不亮
  RectAreaLightUniformsLib.init()

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  grid = new GridHelper(10, 20, '#475569', '#1f2937')
  grid.visible = showGrid.value
  scene.add(grid)

  ground = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshStandardMaterial({ color: '#94a3b8', roughness: 0.92, metalness: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.visible = showGround.value
  scene.add(ground)

  canvasHost.value?.appendChild(renderer.domElement)

  resizeObserver = new ResizeObserver(() => resizeViewer())
  if (canvasHost.value) resizeObserver.observe(canvasHost.value)

  resizeViewer()
  renderLoop(performance.now())
}

function applyRendererTone() {
  if (!renderer) return
  renderer.toneMapping = useAces.value ? ACESFilmicToneMapping : LinearToneMapping
  renderer.toneMappingExposure = exposure.value
}

async function loadModel(key) {
  const option = MODEL_OPTIONS.find((item) => item.key === key) ?? MODEL_OPTIONS[0]
  loader ??= new GLTFLoader()
  isLoading.value = true
  status.value = `正在加载支架模型：${option.name}`

  try {
    const gltf = await loader.loadAsync(option.url)
    replaceModel(gltf.scene, option.name)
  } catch (error) {
    status.value = `模型加载失败：${error.message}`
  } finally {
    isLoading.value = false
  }
}

function replaceModel(nextModel, name) {
  if (modelRoot) {
    scene.remove(modelRoot)
    disposeObject(modelRoot)
  }

  nextModel.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
  })
  nextModel.updateWorldMatrix(true, true)
  scene.add(nextModel)
  modelRoot = nextModel
  modelName.value = name

  measureModel(nextModel)
  layoutStage()
  fitCameraToModel()
  buildLightRig()
  applyShadowSetting()

  status.value = `支架已就绪：${name}，包围球半径 ${modelRadius.toFixed(2)}`
}

function measureModel(model) {
  const box = new Box3().setFromObject(model)
  if (box.isEmpty()) {
    modelCenter.set(0, 0, 0)
    modelRadius = 1
    return
  }

  const sphere = box.getBoundingSphere(new Sphere())
  modelCenter.copy(sphere.center)
  modelRadius = Math.max(sphere.radius, 0.001)
  ground.position.set(modelCenter.x, box.min.y - modelRadius * 0.002, modelCenter.z)
  // 网格略微抬高，避免和地面共面闪烁
  grid.position.set(ground.position.x, ground.position.y + modelRadius * 0.001, ground.position.z)
}

function layoutStage() {
  ground.geometry.dispose()
  ground.geometry = new PlaneGeometry(modelRadius * 12, modelRadius * 12)
  grid.scale.setScalar(Math.max((modelRadius * 6) / 10, 0.1))
}

// 灯光位置、强度、阴影范围都按模型半径换算，换模型就整套重建
function buildLightRig() {
  disposeLightRig()
  lights.value = createLightConfigs(modelRadius)
  soloId.value = null
  orbitAngle = 0

  for (const config of lights.value) {
    const created = createLightObject(config)
    if (!created) continue

    const { light, target } = created
    if (config.supportsShadow) {
      configureLightShadow(light, { radius: modelRadius })
    }
    if (target) {
      target.position.copy(modelCenter)
      scene.add(target)
      light.target = target
    }
    scene.add(light)

    const helperResult = createLightHelper(light, config, modelRadius * 0.35)
    if (helperResult?.attachToLight) {
      light.add(helperResult.helper)
    } else if (helperResult) {
      scene.add(helperResult.helper)
    }

    lightRig.set(config.id, { light, target, helper: helperResult?.helper ?? null })
  }

  syncLights()
}

function disposeLightRig() {
  for (const entry of lightRig.values()) {
    if (entry.helper) {
      entry.helper.parent?.remove(entry.helper)
      disposeObject(entry.helper)
    }
    if (entry.target) scene?.remove(entry.target)
    scene?.remove(entry.light)
    entry.light.dispose?.()
  }
  lightRig.clear()
}

function syncLights() {
  if (!lightRig.size) return

  const visible = visibleLightIds.value
  for (const config of lights.value) {
    const entry = lightRig.get(config.id)
    if (!entry) continue

    applyLightConfig(entry.light, config, { orbitAngle, lookAt: modelCenter })
    entry.light.visible = visible.has(config.id)
    entry.target?.position.copy(modelCenter)

    if (entry.helper) {
      entry.helper.visible = entry.light.visible && showHelpers.value && config.showHelper !== false
    }
  }
  refreshHelpers()
}

// helper 的线框依赖灯光的世界矩阵，所以要在矩阵更新之后再刷新
function refreshHelpers() {
  for (const entry of lightRig.values()) {
    if (!entry.helper?.visible) continue
    entry.light.updateMatrixWorld(true)
    entry.target?.updateMatrixWorld(true)
    entry.helper.update?.()
  }
}

function applyShadowSetting() {
  if (!renderer) return

  renderer.shadowMap.enabled = shadowsEnabled.value
  renderer.shadowMap.needsUpdate = true
  // 开关阴影会改变着色器分支，必须让已编译的材质重新编译
  modelRoot?.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (material) material.needsUpdate = true
    }
  })
  if (ground?.material) ground.material.needsUpdate = true
}

function fitCameraToModel() {
  const distance = modelRadius * 3.2
  camera.near = Math.max(distance / 200, 0.01)
  camera.far = distance * 100
  camera.position.set(
    modelCenter.x + distance * 0.75,
    modelCenter.y + distance * 0.55,
    modelCenter.z + distance * 0.85,
  )
  camera.lookAt(modelCenter)

  controls.target.copy(modelCenter)
  controls.update()
  resizeViewer()
}

function resizeViewer() {
  if (!canvasHost.value || !renderer || !camera) return

  const width = Math.max(canvasHost.value.clientWidth, 1)
  const height = Math.max(canvasHost.value.clientHeight, 1)

  renderer.setSize(width, height, false)
  updateViewerCameraProjection(camera, { width, height, target: controls?.target ?? modelCenter })
}

function renderLoop(now) {
  frameId = requestAnimationFrame(renderLoop)

  const delta = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.1) : 0
  lastFrameTime = now

  if (orbitLights.value && delta) {
    orbitAngle = (orbitAngle + delta * orbitSpeed.value) % (Math.PI * 2)
    updateLightOrbit()
  }

  controls?.update()
  renderer?.render(scene, camera)
}

// 动画只改灯光实际位置，面板里的基准坐标保持不变
function updateLightOrbit() {
  for (const config of lights.value) {
    if (!config.position) continue
    const entry = lightRig.get(config.id)
    if (!entry?.light.visible) continue
    applyLightConfig(entry.light, config, { orbitAngle, lookAt: modelCenter })
  }
  refreshHelpers()
}

function toggleSolo(id) {
  soloId.value = soloId.value === id ? null : id
}

function setAllEnabled(enabled) {
  soloId.value = null
  for (const config of lights.value) {
    config.enabled = enabled
  }
}

function resetLight(id) {
  const index = lights.value.findIndex((config) => config.id === id)
  const preset = LIGHT_PRESETS.find((item) => item.id === id)
  if (index < 0 || !preset) return
  lights.value[index] = scaleLightConfig(preset, modelRadius)
}

function resetAll() {
  lights.value = createLightConfigs(modelRadius)
  soloId.value = null
  orbitAngle = 0
  orbitLights.value = false
  exposure.value = 1
  useAces.value = true
  shadowsEnabled.value = true
  status.value = '已恢复全部灯光与渲染参数的默认值。'
}

function isVisible(config) {
  return visibleLightIds.value.has(config.id)
}

function formatNumber(value) {
  const number = Number(value) || 0
  const abs = Math.abs(number)
  if (abs >= 100) return number.toFixed(0)
  if (abs >= 10) return number.toFixed(1)
  return number.toFixed(2)
}

function disposeObject(root) {
  root.traverse?.((object) => {
    object.geometry?.dispose?.()
    const material = object.material
    if (Array.isArray(material)) {
      material.forEach((item) => item?.dispose?.())
    } else {
      material?.dispose?.()
    }
  })
}
</script>

<template>
  <main class="debug-page">
    <header class="debug-header">
      <div>
        <p class="debug-eyebrow">ZF18000 · 灯光实验室</p>
        <h1>Three.js 六种灯光 API 打在支架上</h1>
      </div>
      <div class="debug-header-actions">
        <RouterLink class="header-link" to="/">返回编辑器</RouterLink>
        <RouterLink class="header-link" to="/zf18000-metal-hdr">HDR 金属</RouterLink>
        <label class="select-field">
          <span>模型</span>
          <select v-model="modelKey">
            <option v-for="option in MODEL_OPTIONS" :key="option.key" :value="option.key">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
    </header>

    <section class="debug-content">
      <div class="viewer-surface">
        <div ref="canvasHost" class="canvas-host" aria-label="ZF18000 灯光效果预览"></div>
      </div>

      <aside class="control-panel">
        <section class="panel-section">
          <h2>场景</h2>
          <dl class="info-list">
            <div>
              <dt>模型</dt>
              <dd>{{ modelName }}</dd>
            </div>
            <div>
              <dt>生效灯光</dt>
              <dd>{{ activeLightLabels.length ? activeLightLabels.join('、') : '全部关闭（画面全黑）' }}</dd>
            </div>
          </dl>
          <p v-if="soloId" class="solo-tip">单看模式：{{ soloLabel }}</p>
          <p class="status-line" :class="{ loading: isLoading }">{{ status }}</p>
          <div class="button-row">
            <button type="button" @click="setAllEnabled(true)">全部打开</button>
            <button type="button" @click="setAllEnabled(false)">全部关闭</button>
            <button type="button" @click="resetAll">恢复默认</button>
          </div>
        </section>

        <section class="panel-section">
          <h2>渲染与舞台</h2>
          <label class="toggle-row">
            <input v-model="shadowsEnabled" type="checkbox" />
            <span>开启阴影（shadowMap）</span>
          </label>
          <label class="toggle-row">
            <input v-model="useAces" type="checkbox" />
            <span>ACESFilmicToneMapping</span>
          </label>
          <label class="toggle-row">
            <input v-model="showHelpers" type="checkbox" />
            <span>显示灯光 helper</span>
          </label>
          <label class="toggle-row">
            <input v-model="showGround" type="checkbox" />
            <span>显示地面（接收阴影）</span>
          </label>
          <label class="toggle-row">
            <input v-model="showGrid" type="checkbox" />
            <span>显示网格</span>
          </label>
          <label class="toggle-row">
            <input v-model="orbitLights" type="checkbox" />
            <span>灯光绕支架旋转</span>
          </label>
          <div class="slider-block">
            <div class="slider-label">
              <span>旋转速度 rad/s</span>
              <strong>{{ formatNumber(orbitSpeed) }}</strong>
            </div>
            <input v-model.number="orbitSpeed" type="range" min="0.05" max="2" step="0.05" :disabled="!orbitLights" />
          </div>
          <div class="slider-block">
            <div class="slider-label">
              <span>toneMappingExposure</span>
              <strong>{{ formatNumber(exposure) }}</strong>
            </div>
            <input v-model.number="exposure" type="range" min="0.1" max="3" step="0.01" />
          </div>
          <label class="color-row">
            <span>背景色</span>
            <input v-model="backgroundColor" type="color" />
          </label>
        </section>

        <article
          v-for="config in lights"
          :key="config.id"
          class="panel-section light-card"
          :class="{ solo: soloId === config.id, dimmed: !isVisible(config) }"
        >
          <header class="light-card-header">
            <label class="toggle-row">
              <input v-model="config.enabled" type="checkbox" />
              <span class="light-name">{{ config.label }}</span>
            </label>
            <button type="button" class="ghost-button" @click="toggleSolo(config.id)">
              {{ soloId === config.id ? '退出单看' : '只看这盏' }}
            </button>
          </header>
          <code class="light-api">{{ config.api }}</code>
          <p class="light-summary">{{ config.summary }}</p>

          <div class="color-grid">
            <label class="color-row">
              <span>{{ config.groundColor !== undefined ? '天空色' : '颜色' }}</span>
              <input v-model="config.color" type="color" />
            </label>
            <label v-if="config.groundColor !== undefined" class="color-row">
              <span>地面色</span>
              <input v-model="config.groundColor" type="color" />
            </label>
          </div>

          <div class="slider-block">
            <div class="slider-label">
              <span>intensity 强度</span>
              <strong>{{ formatNumber(config.intensity) }}</strong>
            </div>
            <input
              v-model.number="config.intensity"
              type="range"
              min="0"
              :max="config.intensityMax"
              :step="config.intensityMax / 200"
            />
          </div>

          <div v-for="slider in config.sliders" :key="slider.key" class="slider-block">
            <div class="slider-label">
              <span>{{ slider.label }}</span>
              <strong>{{ formatNumber(config[slider.key]) }}</strong>
            </div>
            <input
              v-model.number="config[slider.key]"
              type="range"
              :min="slider.min"
              :max="slider.max"
              :step="slider.step"
            />
          </div>

          <template v-if="config.position">
            <div v-for="axis in ['x', 'y', 'z']" :key="axis" class="slider-block">
              <div class="slider-label">
                <span>position.{{ axis }}</span>
                <strong>{{ formatNumber(config.position[axis]) }}</strong>
              </div>
              <input
                v-model.number="config.position[axis]"
                type="range"
                :min="-config.positionRange"
                :max="config.positionRange"
                :step="config.positionRange / 100"
              />
            </div>
          </template>

          <div class="light-flags">
            <label v-if="config.supportsShadow" class="toggle-row">
              <input v-model="config.castShadow" type="checkbox" />
              <span>castShadow</span>
            </label>
            <label v-if="config.supportsHelper" class="toggle-row">
              <input v-model="config.showHelper" type="checkbox" />
              <span>helper</span>
            </label>
            <button type="button" class="ghost-button" @click="resetLight(config.id)">重置这盏</button>
          </div>

          <p class="hint-text">{{ config.note }}</p>
        </article>

        <section class="panel-section">
          <h2>说明</h2>
          <ul class="hint-list">
            <li>路由：<code>/lighting-lab</code>，灯光逻辑在 <code>src/lightingLab.js</code></li>
            <li>「只看这盏」会临时屏蔽其它灯，用来单独观察某个 API 的效果</li>
            <li>强度与位置按包围球半径换算：点光/聚光是坎德拉，照度按 1/d² 衰减</li>
            <li>环境光与半球光不产生阴影，面光源不支持阴影</li>
            <li>另一类光源 <code>THREE.LightProbe</code> 需要从环境贴图烘焙球谐系数，见 HDR 金属页</li>
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
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.header-link,
.button-row button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.header-link {
  min-height: 36px;
  padding: 0 14px;
}

.header-link:hover,
.button-row button:hover,
.ghost-button:hover {
  background: #334155;
}

.select-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b;
  font-size: 13px;
  font-weight: 600;
}

.select-field select {
  border: none;
  background: transparent;
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
}

.select-field option {
  color: #0f172a;
}

.debug-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  min-height: 0;
}

.viewer-surface {
  min-height: 0;
  padding: 20px 20px 20px 24px;
}

.canvas-host {
  position: sticky;
  top: 20px;
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

.light-card.solo {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35);
}

.light-card.dimmed {
  opacity: 0.55;
}

.light-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.light-name {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
}

.light-api {
  display: block;
  padding: 6px 8px;
  border-radius: 4px;
  background: #0f172a;
  color: #93c5fd;
  font-size: 11px;
  word-break: break-all;
}

.light-summary {
  margin: 0;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.55;
}

.light-flags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.info-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

.info-list div {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
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

.solo-tip {
  margin: 0;
  color: #38bdf8;
  font-size: 12px;
  font-weight: 600;
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

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #cbd5e1;
  cursor: pointer;
}

.color-row input[type='color'] {
  width: 42px;
  height: 26px;
  padding: 0;
  border: 1px solid #475569;
  border-radius: 4px;
  background: transparent;
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
  font-size: 12px;
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
    position: static;
    height: 56vh;
    min-height: 360px;
  }
}
</style>
