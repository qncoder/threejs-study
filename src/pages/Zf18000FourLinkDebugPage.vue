<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LinearToneMapping,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import defaultModelUrl from '../ZF18000.glb?url'
import { CAMERA_MODES, createViewerCamera, updateViewerCameraProjection } from '../viewerCamera.js'
import { prepareLoadedModelStructure } from '../modelLoadSetup.js'
import { collectNodeRows } from '../modelStructure.js'
import { filterCollapsedNodeRows } from '../nodeCollapse.js'
import { filterNodeRowsByKeyword } from '../nodeSearch.js'
import {
  areAllNodesHidden,
  collectEffectivelyHiddenNodeUuids,
  createAllHiddenNodeSet,
  isNodeEffectivelyHidden,
  toggleHiddenNode,
} from '../nodeVisibility.js'
import {
  DEFAULT_FOUR_LINK_FOLLOWERS,
  DEFAULT_FOUR_LINK_NODE_NAMES,
  applyFourLinkSolution,
  createFourLinkState,
  findFourLinkSolution,
  resetFourLink,
  solveFourLink,
} from '../zf18000FourLinkMotion.js'
import { applyZf18000FourLinkLookAt } from '../zf18000FourLinkLookAt.js'

const DRIVE_RANGE_RATIO = 0.3
const NODE_PREVIEW_LIMIT = 180
const POINT_COLORS = {
  hydraulicFixedAxis: '#0f766e',
  hydraulicSlidingShaft: '#14b8a6',
  crankMiddelFixed: '#7c3aed',
  crankMiddelSliding: '#a855f7',
  crankAfterFixed: '#b45309',
  crankAfterSliding: '#f97316',
}

const NODE_ROWS = [
  { key: 'hydraulicFixedAxis', label: '固定点 1' },
  { key: 'hydraulicSlidingShaft', label: '运动点 1' },
  { key: 'crankMiddelFixed', label: '固定点 2' },
  { key: 'crankMiddelSliding', label: '运动点 2' },
  { key: 'crankAfterFixed', label: '固定点 3' },
  { key: 'crankAfterSliding', label: '运动点 3' },
]

const LINK_LINES = [
  ['hydraulicFixedAxis', 'hydraulicSlidingShaft'],
  ['hydraulicFixedAxis', 'crankMiddelFixed'],
  ['hydraulicSlidingShaft', 'crankMiddelSliding'],
  ['crankMiddelFixed', 'crankMiddelSliding'],
  ['crankMiddelSliding', 'crankAfterSliding'],
  ['crankMiddelFixed', 'crankAfterFixed'],
  ['crankAfterFixed', 'crankAfterSliding'],
]

const canvasHost = ref(null)
const status = ref('正在加载默认模型 ZF18000.glb')
const isLoading = ref(false)
const fileName = ref('ZF18000.glb')
const driverProgress = ref(0.5)
const nodeNames = ref({ ...DEFAULT_FOUR_LINK_NODE_NAMES })
const missingNodes = ref([])
const solutionInfo = ref(null)
const modelRoot = ref(null)
const motionState = ref(null)
const nodeRows = ref([])
const nodeKeyword = ref('')
const collapsedNodeUuids = ref(new Set())
const hiddenNodeUuids = ref(new Set())
const showModel = ref(true)

let scene
let camera
let renderer
let controls
let grid
let loader
let helperGroup
let resizeObserver
let frameId = 0

const progressText = computed(() => `${Math.round(driverProgress.value * 100)}%`)
const hasModel = computed(() => Boolean(modelRoot.value))
const canControl = computed(() => hasModel.value && Boolean(motionState.value) && !isLoading.value)
const visibleNodeRows = computed(() => filterCollapsedNodeRows(nodeRows.value, collapsedNodeUuids.value))
const filteredNodeRows = computed(() => filterNodeRowsByKeyword(visibleNodeRows.value, nodeKeyword.value))
const nodePreviewRows = computed(() => filteredNodeRows.value.slice(0, NODE_PREVIEW_LIMIT))
const allNodesHidden = computed(() => areAllNodesHidden(modelRoot.value, hiddenNodeUuids.value))
const effectivelyHiddenNodeUuids = computed(() =>
  collectEffectivelyHiddenNodeUuids(modelRoot.value, hiddenNodeUuids.value),
)
const targetABText = computed(() => {
  if (!motionState.value) return '-'
  return targetABFromProgress(driverProgress.value).toFixed(4)
})
const detailRows = computed(() => {
  if (!solutionInfo.value) return []

  return [
    { label: '目标 ab', value: solutionInfo.value.driver.ab.toFixed(4) },
    { label: '求解 ac', value: solutionInfo.value.ac.toFixed(4) },
    { label: '误差', value: solutionInfo.value.errorOffset.toFixed(4) },
    { label: 'angABC', value: `${solutionInfo.value.angles.angABC.toFixed(2)}°` },
    { label: 'angDCF', value: `${solutionInfo.value.angles.angDCF.toFixed(2)}°` },
    { label: 'angCFE', value: `${solutionInfo.value.angles.angCFE.toFixed(2)}°` },
  ]
})

onMounted(() => {
  initViewer()
  loadDefaultModel()
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  controls?.dispose()
  clearHelperGroup()
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
  helperGroup = new Group()
  helperGroup.name = 'fourLinkDebugHelpers'

  scene.add(grid)
  scene.add(helperGroup)
  scene.add(new AmbientLight(0xffffff, 1.25))
  scene.add(new HemisphereLight(0xffffff, 0xd6d3d1, 0.9))

  const keyLight = new DirectionalLight(0xffffff, 1.2)
  keyLight.position.set(8, 10, 6)
  scene.add(keyLight)

  const fillLight = new DirectionalLight(0xffffff, 0.55)
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
    solutionInfo.value = null
    resetDebugNodePanel()
    clearHelperGroup()
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

  const lookAtResult = applyZf18000FourLinkLookAt(nextModel)

  modelRoot.value = nextModel
  resetDebugNodePanel()
  refreshNodeRows()
  applyDebugNodeVisibility()
  fileName.value = name
  driverProgress.value = 0.5
  fitCameraToModel(nextModel)
  initializeFourLink(true, createLoadStatus(name, lookAtResult))
}

function initializeFourLink(silent = false, nextStatus = '') {
  if (!modelRoot.value) return

  if (motionState.value) {
    resetFourLink(modelRoot.value, motionState.value)
  }

  const stateResult = createFourLinkState(modelRoot.value, nodeNames.value, {
    axis: [1, 0, 0],
    movingNodeFollowers: DEFAULT_FOUR_LINK_FOLLOWERS,
  })

  if (!stateResult.ok) {
    motionState.value = null
    solutionInfo.value = null
    missingNodes.value = stateResult.missing ?? []
    status.value = stateResult.error
    clearHelperGroup()
    return
  }

  motionState.value = stateResult.state
  missingNodes.value = []
  showInitialSolution(silent, nextStatus)
}

function applyDriverProgress(nextProgress = driverProgress.value, silent = false) {
  if (!modelRoot.value || !motionState.value) return

  const safeProgress = clamp(nextProgress, 0, 1)
  if (Math.abs(safeProgress - 0.5) < 0.0001) {
    const resetResult = resetFourLink(modelRoot.value, motionState.value)
    if (!resetResult.ok) {
      status.value = resetResult.error
      return
    }

    driverProgress.value = 0.5
    showInitialSolution(silent)
    return
  }

  const targetAB = targetABFromProgress(safeProgress)
  const solutionResult = findFourLinkSolution(motionState.value, {
    ab: targetAB,
    preferredAC: motionState.value.currentAC,
  })

  if (!solutionResult.ok) {
    solutionInfo.value = null
    status.value = solutionResult.error
    updateHelpers()
    return
  }

  const applyResult = applyFourLinkSolution(modelRoot.value, motionState.value, solutionResult.solution)
  if (!applyResult.ok) {
    solutionInfo.value = null
    status.value = applyResult.error
    updateHelpers()
    return
  }

  driverProgress.value = safeProgress
  solutionInfo.value = solutionResult.solution
  updateHelpers()

  if (silent) {
    status.value = `模型已就绪：${fileName.value}`
  } else {
    status.value = `已更新四连杆控制点，误差 ${solutionResult.solution.errorOffset.toFixed(4)}°`
  }
}

function showInitialSolution(silent = false, nextStatus = '') {
  if (!motionState.value) return

  const solveResult = solveFourLink(motionState.value, motionState.value.currentAC)
  if (solveResult.ok) {
    solutionInfo.value = {
      ...solveResult,
      driver: {
        ab: motionState.value.lengths.ab,
        ad: motionState.value.lengths.ad,
        ADE: motionState.value.angles.ADE,
      },
    }
  } else {
    solutionInfo.value = null
  }

  updateHelpers()

  if (nextStatus) {
    status.value = nextStatus
  } else if (silent) {
    status.value = `模型已就绪：${fileName.value}，当前保持 GLB 初始姿态。`
  } else {
    status.value = '已保持 GLB 初始姿态。'
  }
}

function handleProgressInput() {
  applyDriverProgress(driverProgress.value)
}

function handleReset() {
  if (!modelRoot.value || !motionState.value) return

  const result = resetFourLink(modelRoot.value, motionState.value)
  if (!result.ok) {
    status.value = result.error
    return
  }

  driverProgress.value = 0.5
  showInitialSolution(false, '已恢复到初始姿态。')
}

function handleReinitialize() {
  driverProgress.value = 0.5
  initializeFourLink()
}

function createLoadStatus(name, lookAtResult) {
  const parts = [`模型已就绪：${name}`]

  if (lookAtResult?.executed?.length) {
    parts.push(`已执行 ${lookAtResult.executed.join('、')} 的 lookAt`)
  }

  if (lookAtResult?.moved) {
    parts.push(`已整理 ${lookAtResult.moved} 个 mesh 的 _pos 层级`)
  }

  if (lookAtResult?.missing?.length) {
    parts.push(`缺少 ${lookAtResult.missing.join('、')}`)
  }

  if (lookAtResult?.errors?.length) {
    parts.push(`有 ${lookAtResult.errors.length} 个脚本执行失败`)
  }

  return `${parts.join('，')}。`
}

function resetDebugNodePanel() {
  nodeRows.value = []
  nodeKeyword.value = ''
  collapsedNodeUuids.value = new Set()
  hiddenNodeUuids.value = new Set()
  showModel.value = true
}

function refreshNodeRows() {
  if (!modelRoot.value) {
    nodeRows.value = []
    return
  }

  modelRoot.value.updateWorldMatrix(true, true)
  nodeRows.value = collectNodeRows(modelRoot.value)
}

function findObjectByUuid(uuid) {
  if (!modelRoot.value || !uuid) return null

  let found = null
  modelRoot.value.traverse((object) => {
    if (object.uuid === uuid) found = object
  })
  return found
}

function canCollapseNode(node) {
  return (node.childCount ?? 0) > 0
}

function isNodeCollapsed(uuid) {
  return collapsedNodeUuids.value.has(uuid)
}

function toggleNodeCollapse(node) {
  if (!canCollapseNode(node)) return

  const nextCollapsed = new Set(collapsedNodeUuids.value)
  if (nextCollapsed.has(node.uuid)) {
    nextCollapsed.delete(node.uuid)
  } else {
    nextCollapsed.add(node.uuid)
  }
  collapsedNodeUuids.value = nextCollapsed
}

function isNodeHidden(node) {
  return effectivelyHiddenNodeUuids.value.has(node.uuid)
}

function toggleNodeVisibility(node) {
  const object = findObjectByUuid(node.uuid)
  if (!object || object === modelRoot.value) return

  const wasHidden = isNodeEffectivelyHidden(object, hiddenNodeUuids.value, modelRoot.value)
  hiddenNodeUuids.value = toggleHiddenNode(object, hiddenNodeUuids.value)
  applyDebugNodeVisibility()

  const isHidden = isNodeEffectivelyHidden(object, hiddenNodeUuids.value, modelRoot.value)
  if (isHidden) {
    status.value = wasHidden && !hiddenNodeUuids.value.has(node.uuid)
      ? `父级已隐藏，当前节点仍不可见：${node.displayName}`
      : `已隐藏节点：${node.displayName}`
  } else {
    status.value = `已显示节点：${node.displayName}`
  }
}

function toggleAllNodesVisibility() {
  if (!modelRoot.value) {
    status.value = '请先加载模型'
    return
  }

  if (allNodesHidden.value) {
    hiddenNodeUuids.value = new Set()
    status.value = '已显示全部节点'
  } else {
    hiddenNodeUuids.value = createAllHiddenNodeSet(modelRoot.value)
    status.value = `已隐藏全部节点：${hiddenNodeUuids.value.size} 个`
  }
  applyDebugNodeVisibility()
}

function toggleModelVisibility() {
  showModel.value = !showModel.value
  applyDebugNodeVisibility()
  status.value = showModel.value ? '模型已显示' : '模型已隐藏'
}

function applyDebugNodeVisibility() {
  if (!modelRoot.value) return

  modelRoot.value.traverse((object) => {
    if (!object.isMesh) return
    object.visible = showModel.value && !isNodeEffectivelyHidden(object, hiddenNodeUuids.value, modelRoot.value)
  })
}

function targetABFromProgress(progress) {
  const baseAB = motionState.value?.lengths?.ab ?? 0
  return baseAB * (1 - DRIVE_RANGE_RATIO + DRIVE_RANGE_RATIO * 2 * clamp(progress, 0, 1))
}

function updateHelpers() {
  clearHelperGroup()
  if (!helperGroup || !motionState.value) return

  modelRoot.value?.updateWorldMatrix(true, true)
  const positions = {}
  for (const row of NODE_ROWS) {
    const object = motionState.value.nodes[row.key]
    positions[row.key] = object.getWorldPosition(new Vector3())
  }

  for (const row of NODE_ROWS) {
    const geometry = new SphereGeometry(0.045, 16, 10)
    const material = new MeshBasicMaterial({ color: POINT_COLORS[row.key] })
    const sphere = new Mesh(geometry, material)
    sphere.name = `helper_${row.key}`
    sphere.position.copy(positions[row.key])
    helperGroup.add(sphere)
  }

  for (const [fromKey, toKey] of LINK_LINES) {
    const geometry = new BufferGeometry().setFromPoints([positions[fromKey], positions[toKey]])
    const material = new LineBasicMaterial({ color: '#1f2937', transparent: true, opacity: 0.75 })
    helperGroup.add(new Line(geometry, material))
  }
}

function clearHelperGroup() {
  if (!helperGroup) return

  while (helperGroup.children.length > 0) {
    const child = helperGroup.children[0]
    helperGroup.remove(child)
    child.geometry?.dispose?.()
    child.material?.dispose?.()
  }
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

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max)
}
</script>

<template>
  <main class="debug-page">
    <header class="debug-header">
      <div>
        <p class="debug-eyebrow">ZF18000</p>
        <h1>四连杆调试</h1>
      </div>
      <div class="debug-header-actions">
        <RouterLink class="header-link" to="/">返回编辑器</RouterLink>
        <RouterLink class="header-link" to="/zf18000-column-height">立柱调试</RouterLink>
        <label class="file-picker">
          <span>更换 GLB</span>
          <input type="file" accept=".glb,model/gltf-binary" @change="handleFileChange" />
        </label>
      </div>
    </header>

    <section class="debug-content">
      <aside class="node-panel">
        <section class="panel-section node-tree-section">
          <div class="section-title-row">
            <h2>模型节点</h2>
            <div class="node-title-actions">
              <button type="button" :disabled="!hasModel" @click="toggleAllNodesVisibility">
                {{ allNodesHidden ? '全部显示' : '全部隐藏' }}
              </button>
              <button type="button" :disabled="!hasModel" @click="toggleModelVisibility">
                {{ showModel ? '隐藏模型' : '显示模型' }}
              </button>
            </div>
          </div>
          <input
            v-model="nodeKeyword"
            class="node-search"
            type="text"
            placeholder="按名称、类型、父节点或路径筛选"
            spellcheck="false"
          />
          <p class="empty-text">
            共 {{ nodeRows.length }} 个节点，当前匹配 {{ filteredNodeRows.length }} 个，列表展示 {{ nodePreviewRows.length }} 条。
          </p>

          <ul v-if="nodePreviewRows.length" class="debug-node-list">
            <li
              v-for="node in nodePreviewRows"
              :key="node.uuid"
              class="debug-node-row"
              :class="{ 'hidden-node': isNodeHidden(node) }"
              :style="{ '--node-indent': `${node.depth * 14}px` }"
            >
              <button
                type="button"
                class="node-collapse-button"
                :class="{ placeholder: !canCollapseNode(node) }"
                :disabled="!canCollapseNode(node)"
                :aria-label="isNodeCollapsed(node.uuid) ? '展开节点' : '折叠节点'"
                @click.stop="toggleNodeCollapse(node)"
              >
                {{ isNodeCollapsed(node.uuid) ? '▶' : '▼' }}
              </button>
              <div class="node-row-text" :title="node.path">
                <span class="node-name">{{ node.displayName }}</span>
                <span class="node-type">{{ node.type }}</span>
              </div>
              <button
                type="button"
                class="node-visibility-button"
                :disabled="node.uuid === modelRoot?.uuid"
                :aria-label="isNodeHidden(node) ? `显示 ${node.displayName}` : `隐藏 ${node.displayName}`"
                :title="isNodeHidden(node) ? '显示节点' : '隐藏节点'"
                @click.stop="toggleNodeVisibility(node)"
              >
                <svg v-if="isNodeHidden(node)" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c5 0 8.5 4.4 9.6 6a2.3 2.3 0 0 1 0 2.1 16.2 16.2 0 0 1-2.1 2.6" />
                  <path d="M6.5 6.5A16 16 0 0 0 2.4 10a2.3 2.3 0 0 0 0 2.1C3.5 13.7 7 18 12 18a9.7 9.7 0 0 0 4-.8" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.4 10a2.3 2.3 0 0 0 0 2.1C3.5 13.7 7 18 12 18s8.5-4.3 9.6-5.9a2.3 2.3 0 0 0 0-2.1C20.5 8.4 17 4 12 4S3.5 8.4 2.4 10Z" />
                  <circle cx="12" cy="11" r="3" />
                </svg>
              </button>
            </li>
          </ul>
          <p v-else class="empty-text">没有匹配的节点。</p>
        </section>
      </aside>

      <div class="viewer-surface">
        <div ref="canvasHost" class="canvas-host" aria-label="ZF18000 四连杆调试预览"></div>
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
              <dt>滑条</dt>
              <dd>{{ progressText }}</dd>
            </div>
            <div>
              <dt>目标 ab</dt>
              <dd>{{ targetABText }}</dd>
            </div>
            <div>
              <dt>验证脚本</dt>
              <dd>script/ZF18000FourLink/run.js</dd>
            </div>
          </dl>
          <p class="status-line" :class="{ loading: isLoading }">{{ status }}</p>
        </section>

        <section class="panel-section">
          <h2>油缸长度</h2>
          <div class="slider-row">
            <span>70%</span>
            <input
              v-model.number="driverProgress"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :disabled="!canControl"
              @input="handleProgressInput"
            />
            <span>130%</span>
          </div>
          <div class="button-row">
            <button type="button" :disabled="!canControl" @click="handleReset">重置</button>
          </div>
        </section>

        <section class="panel-section">
          <h2>节点映射</h2>
          <div class="node-form">
            <label v-for="row in NODE_ROWS" :key="row.key">
              <span>{{ row.label }}</span>
              <input v-model.trim="nodeNames[row.key]" type="text" spellcheck="false" />
            </label>
          </div>
          <div class="button-row">
            <button type="button" :disabled="!hasModel || isLoading" @click="handleReinitialize">重新读取节点</button>
          </div>
        </section>

        <section class="panel-section">
          <h2>解算结果</h2>
          <dl v-if="detailRows.length > 0" class="info-list">
            <div v-for="row in detailRows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
          <p v-else class="empty-text">有可用解后会显示当前误差和主角度。</p>
        </section>

        <section class="panel-section">
          <h2>节点检查</h2>
          <ul v-if="missingNodes.length > 0" class="missing-list">
            <li v-for="name in missingNodes" :key="name">{{ name }}</li>
          </ul>
          <p v-else class="empty-text">六个四连杆节点已找到。</p>
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
  grid-template-columns: 300px minmax(0, 1fr) 380px;
  min-height: 0;
}

.node-panel {
  min-width: 0;
  padding: 20px 0 24px 24px;
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

.node-tree-section {
  max-height: calc(100vh - 118px);
  min-height: 0;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.node-title-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.node-title-actions button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid #d6d3d1;
  border-radius: 6px;
  background: #ffffff;
  color: #1c1917;
  font-size: 12px;
  font-weight: 600;
}

.node-title-actions button:disabled {
  color: #a8a29e;
  background: #f5f5f4;
}

.node-search {
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d6d3d1;
  border-radius: 6px;
  background: #ffffff;
  color: #1c1917;
  font: inherit;
}

.debug-node-list {
  display: grid;
  gap: 4px;
  max-height: calc(100vh - 290px);
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.debug-node-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 4px 6px 4px calc(6px + var(--node-indent));
  border: 1px solid transparent;
  border-radius: 6px;
  background: #ffffff;
}

.debug-node-row.hidden-node {
  opacity: 0.55;
}

.node-collapse-button,
.node-visibility-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #d6d3d1;
  border-radius: 5px;
  background: #ffffff;
  color: #44403c;
}

.node-collapse-button.placeholder {
  visibility: hidden;
}

.node-collapse-button:disabled,
.node-visibility-button:disabled {
  color: #a8a29e;
  background: #f5f5f4;
}

.node-row-text {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.node-name,
.node-type {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-name {
  font-size: 12px;
  font-weight: 600;
}

.node-type {
  color: #78716c;
  font-size: 11px;
}

.node-visibility-button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.info-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

.info-list div {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
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
  flex-wrap: wrap;
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

.node-form {
  display: grid;
  gap: 8px;
}

.node-form label {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: #57534e;
  font-size: 12px;
}

.node-form input {
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d6d3d1;
  border-radius: 6px;
  background: #ffffff;
  color: #1c1917;
  font: inherit;
}

.empty-text {
  margin: 0;
  color: #57534e;
  font-size: 12px;
  line-height: 1.6;
}

.missing-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.missing-list li {
  padding: 10px 12px;
  border-radius: 6px;
  color: #9a3412;
  background: #ffffff;
  word-break: break-all;
}

@media (max-width: 1120px) {
  .debug-content {
    grid-template-columns: 1fr;
  }

  .node-panel {
    padding: 20px 24px 0;
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

  .node-tree-section {
    max-height: none;
  }

  .debug-node-list {
    max-height: 280px;
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

  .node-panel,
  .viewer-surface,
  .control-panel {
    padding: 16px;
  }

  .canvas-host {
    height: 48vh;
    min-height: 320px;
  }

  .node-form label {
    grid-template-columns: 1fr;
  }

  .section-title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .node-title-actions {
    justify-content: flex-start;
  }
}
</style>
