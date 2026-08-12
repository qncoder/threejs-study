<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  LinearToneMapping,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clone as cloneGltfScene } from 'three/examples/jsm/utils/SkeletonUtils.js'
import defaultModelUrl from '../ZF18000-scence-action.glb?url'
import { CAMERA_MODES, createViewerCamera, updateViewerCameraProjection } from '../viewerCamera.js'
import { runNodeControlScript } from '../nodeScriptControl.js'
import { applyLookAtMeshHierarchy } from '../lookAtScript.js'
import { prepareLoadedModelStructure } from '../modelLoadSetup.js'
import {
  ZF18000_BATCH_COUNT,
  ZF18000_BATCH_SPACING,
  createZf18000BatchPositions,
} from '../zf18000BatchLayout.js'
import {
  createZf18000ControlRigScriptContext,
  createZf18000InstancedBatch,
  syncControlRigToInstancedBatch,
} from '../zf18000InstancedBatch.js'
import flapLookAtScript from '../../script/Flap1_ZF18000/lookAt.js?raw'
import flapRunScript from '../../script/Flap1_ZF18000/run.js?raw'

const canvasHost = ref(null)
const status = ref('正在加载默认模型 ZF18000.glb')
const isLoading = ref(false)
const loadedCount = ref(0)
const instancedMeshCount = ref(0)
const selectedSupportNumber = ref(1)
const scriptSource = ref(flapRunScript.trimEnd())
const scriptMessage = ref('请选择支架后执行脚本。')
const controlRigCount = ref(0)
const syncedMeshCount = ref(0)

let scene
let camera
let renderer
let controls
let grid
let loader
let batchRoot
let raycaster
let pointer
let resizeObserver
let frameId = 0
let batchPositions = []
let instancedRecords = []
let controlTemplateModel = null
const controlRigCache = new Map()

const spacingText = computed(() => ZF18000_BATCH_SPACING.toFixed(2))
const canExecuteScript = computed(
  () =>
    !isLoading.value &&
    loadedCount.value > 0 &&
    selectedSupportNumber.value >= 1 &&
    selectedSupportNumber.value <= loadedCount.value &&
    scriptSource.value.trim().length > 0
)

onMounted(() => {
  initViewer()
  loadBatchModels()
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  renderer?.domElement?.removeEventListener('pointerdown', handleCanvasPointerDown)
  controls?.dispose()
  renderer?.dispose()
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  scene?.clear()
})

function initViewer() {
  scene = new Scene()
  scene.background = new Color('#f8fafc')

  camera = createViewerCamera(CAMERA_MODES.PERSPECTIVE, {
    aspect: 1,
    position: new Vector3(18, 12, 18),
    target: new Vector3(),
  })

  renderer = new WebGLRenderer({ antialias: true })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = LinearToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)
  raycaster = new Raycaster()
  pointer = new Vector2()

  grid = new GridHelper(220, 220, 0xcbd5e1, 0xe2e8f0)
  scene.add(grid)
  scene.add(new AmbientLight(0xffffff, 1.35))
  scene.add(new HemisphereLight(0xffffff, 0xcbd5e1, 0.9))

  const keyLight = new DirectionalLight(0xffffff, 1.25)
  keyLight.position.set(10, 14, 8)
  scene.add(keyLight)

  const fillLight = new DirectionalLight(0xffffff, 0.65)
  fillLight.position.set(-8, 6, -6)
  scene.add(fillLight)

  canvasHost.value?.appendChild(renderer.domElement)
  renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown)

  resizeObserver = new ResizeObserver(() => {
    resizeViewer()
  })
  if (canvasHost.value) {
    resizeObserver.observe(canvasHost.value)
  }

  resizeViewer()
  renderLoop()
}

async function loadBatchModels() {
  loader ??= new GLTFLoader()
  isLoading.value = true
  status.value = '正在加载 ZF18000.glb，完成后会用 InstancedMesh 创建 200 台模型。'

  try {
    const gltf = await loader.loadAsync(defaultModelUrl)
    createBatchFromTemplate(gltf.scene)
  } catch (error) {
    status.value = `模型加载失败：${error.message}`
    loadedCount.value = 0
    instancedMeshCount.value = 0
    scriptMessage.value = '模型加载失败，暂时不能执行脚本。'
    clearControlRigs()
  } finally {
    isLoading.value = false
  }
}

function createBatchFromTemplate(templateModel) {
  if (batchRoot) {
    scene.remove(batchRoot)
  }

  prepareLoadedModelStructure(templateModel)
  templateModel.updateWorldMatrix(true, true)

  const positions = createZf18000BatchPositions()
  const result = createZf18000InstancedBatch(templateModel, positions)
  batchRoot = result.root
  batchPositions = positions
  instancedRecords = result.records
  controlTemplateModel = templateModel
  clearControlRigs()

  scene.add(batchRoot)
  batchRoot.updateWorldMatrix(true, true)
  loadedCount.value = result.instanceCount
  instancedMeshCount.value = result.meshCount
  selectedSupportNumber.value = 1
  syncedMeshCount.value = 0
  scriptMessage.value = '已准备好脚本编辑器。'
  fitCameraToModel(batchRoot)
  status.value = `已用 InstancedMesh 创建 ${positions.length} 个 ZF18000，沿 X 轴从原点开始，间隔 ${ZF18000_BATCH_SPACING}。`
}

function handleCanvasPointerDown(event) {
  if (!batchRoot || !raycaster || !pointer || !renderer) return

  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster
    .intersectObjects(batchRoot.children, false)
    .find((item) => Number.isInteger(item.instanceId))

  if (!hit) return

  selectedSupportNumber.value = hit.instanceId + 1
  scriptMessage.value = `已选中第 ${selectedSupportNumber.value} 台支架。`
}

function executeSelectedScript() {
  if (!canExecuteScript.value) {
    scriptMessage.value = '请选择有效的支架编号，并填写脚本。'
    return
  }

  const instanceIndex = normalizeSelectedSupportIndex()
  const rigResult = getOrCreateControlRig(instanceIndex)

  if (!rigResult.ok) {
    scriptMessage.value = rigResult.error
    return
  }

  const runResult = runNodeControlScript(
    rigResult.scriptNode,
    scriptSource.value,
    createZf18000ControlRigScriptContext(rigResult.rig)
  )
  if (!runResult.ok) {
    scriptMessage.value = `脚本执行失败：${runResult.error}`
    return
  }

  const syncResult = syncControlRigToInstancedBatch(
    rigResult.rig,
    instanceIndex,
    instancedRecords,
    batchRoot
  )
  syncedMeshCount.value = syncResult.updated
  scriptMessage.value = `第 ${instanceIndex + 1} 台支架已执行脚本，已同步 ${syncResult.updated} 个 Mesh。`
}

function resetSelectedSupport() {
  if (!loadedCount.value) return

  const instanceIndex = normalizeSelectedSupportIndex()
  controlRigCache.delete(instanceIndex)
  controlRigCount.value = controlRigCache.size

  const rigResult = getOrCreateControlRig(instanceIndex)
  if (!rigResult.ok) {
    scriptMessage.value = rigResult.error
    return
  }

  const syncResult = syncControlRigToInstancedBatch(
    rigResult.rig,
    instanceIndex,
    instancedRecords,
    batchRoot
  )
  syncedMeshCount.value = syncResult.updated
  scriptMessage.value = `第 ${instanceIndex + 1} 台支架已恢复到初始状态。`
}

function loadDefaultRunScript() {
  scriptSource.value = flapRunScript.trimEnd()
  scriptMessage.value = '已载入 Flap1_ZF18000/run.js。'
}

function getOrCreateControlRig(instanceIndex) {
  const cached = controlRigCache.get(instanceIndex)
  if (cached) {
    return {
      ok: true,
      rig: cached,
      scriptNode: findFlapScriptNode(cached),
      error: '',
    }
  }
  if (!controlTemplateModel) {
    return { ok: false, rig: null, error: '模型还没有加载完成。' }
  }

  const position = batchPositions[instanceIndex]
  if (!position) {
    return { ok: false, rig: null, error: '没有找到对应支架的位置。' }
  }

  const rig = cloneGltfScene(controlTemplateModel)
  rig.name = `ZF18000_control_${instanceIndex + 1}`
  rig.position.set(position.x, position.y, position.z)
  rig.updateWorldMatrix(true, true)

  const scriptNode = findFlapScriptNode(rig)
  const lookAtResult = runNodeControlScript(
    scriptNode,
    flapLookAtScript,
    createZf18000ControlRigScriptContext(rig)
  )
  if (!lookAtResult.ok) {
    return {
      ok: false,
      rig: null,
      error: `lookAt 初始化失败：${lookAtResult.error}`,
    }
  }

  applyLookAtMeshHierarchy(rig, scriptNode)
  rig.updateWorldMatrix(true, true)
  controlRigCache.set(instanceIndex, rig)
  controlRigCount.value = controlRigCache.size
  return { ok: true, rig, scriptNode, error: '' }
}

function findFlapScriptNode(rig) {
  return rig.getObjectByName('Flap1') ?? rig.getObjectByName('flap1') ?? rig
}

function normalizeSelectedSupportIndex() {
  const maxIndex = Math.max(loadedCount.value - 1, 0)
  const value = Number(selectedSupportNumber.value)
  const index = Number.isFinite(value) ? Math.round(value) - 1 : 0
  const normalizedIndex = Math.min(Math.max(index, 0), maxIndex)
  selectedSupportNumber.value = normalizedIndex + 1
  return normalizedIndex
}

function clearControlRigs() {
  controlRigCache.clear()
  controlRigCount.value = 0
}

function fitCameraToModel(model) {
  const box = new Box3().setFromObject(model)
  if (box.isEmpty()) return

  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  const maxSize = Math.max(size.x, size.y, size.z) || 1
  const distance = maxSize * 0.95

  camera.near = Math.max(distance / 300, 0.01)
  camera.far = distance * 20
  camera.position.set(center.x, center.y + distance * 0.55, center.z + distance)
  camera.lookAt(center)

  updateViewerCameraProjection(camera, {
    width: canvasHost.value?.clientWidth,
    height: canvasHost.value?.clientHeight,
    target: center,
  })

  controls.target.copy(center)
  controls.update()

  grid.position.set(center.x, box.min.y - maxSize * 0.02, center.z)
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
  <main class="batch-page">
    <header class="batch-header">
      <div>
        <p class="batch-eyebrow">ZF18000</p>
        <h1>200 台模型批量加载</h1>
      </div>
      <RouterLink class="header-link" to="/">返回编辑器</RouterLink>
    </header>

    <section class="batch-content">
      <div class="viewer-surface">
        <div ref="canvasHost" class="canvas-host" aria-label="ZF18000 200 台模型批量预览"></div>
      </div>

      <aside class="control-panel">
        <section class="panel-section">
          <h2>批量参数</h2>
          <dl class="info-list">
            <div>
              <dt>模型数量</dt>
              <dd>{{ ZF18000_BATCH_COUNT }}</dd>
            </div>
            <div>
              <dt>已创建</dt>
              <dd>{{ loadedCount }}</dd>
            </div>
            <div>
              <dt>InstancedMesh</dt>
              <dd>{{ instancedMeshCount }}</dd>
            </div>
            <div>
              <dt>控制节点缓存</dt>
              <dd>{{ controlRigCount }}</dd>
            </div>
            <div>
              <dt>排列方向</dt>
              <dd>X 轴</dd>
            </div>
            <div>
              <dt>间隔</dt>
              <dd>{{ spacingText }}</dd>
            </div>
          </dl>
          <p class="status-line" :class="{ loading: isLoading }">{{ status }}</p>
        </section>

        <section class="panel-section">
          <h2>运动脚本</h2>
          <label class="field-row">
            <span>支架编号</span>
            <input
              v-model.number="selectedSupportNumber"
              type="number"
              min="1"
              :max="loadedCount || ZF18000_BATCH_COUNT"
              :disabled="isLoading || loadedCount === 0"
            />
          </label>
          <div class="script-actions">
            <button type="button" :disabled="!canExecuteScript" @click="executeSelectedScript">
              执行脚本
            </button>
            <button type="button" :disabled="isLoading || loadedCount === 0" @click="resetSelectedSupport">
              重置当前
            </button>
            <button type="button" @click="loadDefaultRunScript">载入默认</button>
          </div>
          <textarea
            v-model="scriptSource"
            class="script-editor"
            spellcheck="false"
            :disabled="isLoading || loadedCount === 0"
            aria-label="支架运动脚本"
          ></textarea>
          <p class="status-line script-message">
            {{ scriptMessage }}
            <span v-if="syncedMeshCount > 0">最近同步 {{ syncedMeshCount }} 个 Mesh。</span>
          </p>
        </section>

        <section class="panel-section">
          <h2>加载方式</h2>
          <p class="note-text">
            当前页面只加载一次 GLB，然后把每个原始 Mesh 转成 InstancedMesh。执行脚本时，会为当前支架创建一套隐藏控制节点，算完动作后同步回对应实例。
          </p>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.batch-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f1f5f9;
  color: #0f172a;
}

.batch-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #dbe3ef;
  background: #ffffff;
}

.batch-eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0;
  color: #2563eb;
  font-weight: 700;
}

.batch-header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
}

.header-link {
  color: #1d4ed8;
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
}

.header-link:hover {
  text-decoration: underline;
}

.batch-content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
}

.viewer-surface {
  min-height: 0;
  padding: 16px;
}

.canvas-host {
  width: 100%;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  background: #ffffff;
}

.canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.control-panel {
  border-left: 1px solid #dbe3ef;
  background: #ffffff;
  padding: 16px;
  overflow: auto;
}

.panel-section {
  border-bottom: 1px solid #e2e8f0;
  padding: 0 0 18px;
  margin: 0 0 18px;
}

.panel-section:last-child {
  border-bottom: 0;
  margin-bottom: 0;
}

.panel-section h2 {
  margin: 0 0 12px;
  font-size: 16px;
  line-height: 1.3;
}

.info-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.info-list div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: baseline;
}

.info-list dt {
  color: #64748b;
  font-size: 13px;
}

.info-list dd {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  text-align: right;
}

.status-line {
  margin: 16px 0 0;
  padding: 10px 12px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1e40af;
  font-size: 13px;
  line-height: 1.5;
}

.status-line.loading {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.field-row {
  display: grid;
  gap: 6px;
  margin: 0 0 12px;
  color: #475569;
  font-size: 13px;
}

.field-row input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  padding: 8px 10px;
  font: inherit;
}

.field-row input:disabled,
.script-editor:disabled {
  background: #f8fafc;
  color: #94a3b8;
}

.script-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 12px;
}

.script-actions button {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  padding: 8px 6px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.script-actions button:hover:not(:disabled) {
  border-color: #2563eb;
  color: #1d4ed8;
}

.script-actions button:disabled {
  cursor: not-allowed;
  color: #94a3b8;
  background: #f8fafc;
}

.script-editor {
  width: 100%;
  height: 280px;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  background: #0f172a;
  color: #e2e8f0;
  padding: 10px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.55;
  resize: vertical;
}

.script-message {
  margin-top: 10px;
}

.script-message span {
  display: block;
  margin-top: 4px;
}

.note-text {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .batch-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .batch-content {
    grid-template-columns: 1fr;
  }

  .control-panel {
    border-left: 0;
    border-top: 1px solid #dbe3ef;
  }

  .canvas-host {
    min-height: 420px;
  }
}
</style>
