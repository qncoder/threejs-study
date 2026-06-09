<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  AmbientLight,
  Box3,
  BoxHelper,
  Color,
  DirectionalLight,
  GridHelper,
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
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import defaultModelUrl from './ZF18000.glb?url'
import {
  CAMERA_MODES,
  createCameraFromCurrent,
  createViewerCamera,
  updateViewerCameraProjection,
} from './viewerCamera.js'
import {
  collectModelInfo,
  collectNodeRows,
  createPoseExport,
  createStructureExport,
} from './modelStructure.js'
import { createEditedGlbFileName, exportModelAsGlb } from './modelExport.js'
import {
  captureOriginalNodeTransforms,
  cloneTransform,
  createTransformDisplayRows,
  readNodeTransform,
  resetAllNodeTransforms,
  resetNodeTransform,
} from './modelTransform.js'
import { captureModelEditState, restoreModelEditState } from './modelHistory.js'
import {
  captureModelSessionState,
  clearModelSessionState,
  loadModelSessionState,
  restoreModelSessionState,
  saveModelSessionState,
} from './modelSessionState.js'
import { prepareLoadedModelStructure } from './modelLoadSetup.js'
import { applyMechanismMotion, clampMotionProgress } from './mechanismMotion.js'
import { applyPoseToModel, applyPoseTransition, normalizePosePayload } from './poseMotion.js'
import { findSelectableNodeUuid } from './modelSelection.js'
import {
  createPartObject3D,
  createSiblingPartObject3D,
  deleteCreatedObject3D,
  initializeMeshObject3Ds,
  isViewerCreatedObject3D,
  moveNodeNextToObject3D,
  moveNodeToObject3D,
  renameCreatedObject3D,
} from './modelGrouping.js'
import { filterCollapsedNodeRows } from './nodeCollapse.js'
import { collectSearchVisibleNodeUuids, filterNodeRowsByKeyword } from './nodeSearch.js'
import {
  DEFAULT_TRANSFORM_MODE,
  TRANSFORM_MODES,
  normalizeTransformMode,
} from './transformModes.js'
import {
  closeNodeContextMenu,
  createClosedNodeContextMenu,
  getNodeContextMenuItems,
  openNodeContextMenu,
} from './nodeContextMenu.js'
import {
  clampDialogLayout,
  createDialogDragState,
  createDialogResizeState,
  moveDialogByPointer,
  resizeDialogByPointer,
  startDialogDrag,
  startDialogResize,
  stopDialogDrag,
  stopDialogResize,
} from './dialogDrag.js'
import { canDropNodeOnTarget } from './nodeDropRules.js'
import { createNodeFocusTarget, applyNodeFocusTarget } from './nodeFocus.js'
import { createNodeInfoSections } from './nodeInfoSections.js'
import {
  areAllNodesHidden,
  collectEffectivelyHiddenNodeUuids,
  createAllHiddenNodeSet,
  isNodeEffectivelyHidden,
  toggleHiddenNode,
} from './nodeVisibility.js'
import { clampPanelWidth } from './panelResize.js'
import {
  clearNodeControlScript,
  createControlScriptEntry,
  createNodeScriptDialogState,
  createTransformScript,
  getBoundNodeControlScripts,
  runNodeControlScript,
  setBoundNodeControlScripts,
} from './nodeScriptControl.js'
import {
  applyLookAtMeshHierarchy,
  isLookAtScriptName,
  restoreLookAtMeshHierarchy,
} from './lookAtScript.js'
import {
  consumeNodeSelectionScrollRequest,
  createNodeSelectionScrollState,
  requestNodeSelectionScroll,
} from './nodeSelectionScroll.js'
import { CONNECTION_DRAFT, MECHANISM_ROLES, enrichNodeRowsWithRoles } from './mechanismRoles.js'
import { getNodeDropPlacement, NODE_DROP_PLACEMENTS } from './nodeDropPlacement.js'
import { copyNodeNameToClipboard } from './nodeClipboard.js'
import { createCodeStats, createScriptSnippetInsertion } from './codeEditor.js'
import {
  SCRIPT_LIBRARY_ITEMS,
  createScriptNameFromFileName,
  loadScriptLibraryItemSource,
} from './scriptLibrary.js'
import { removeScriptDebugHelpers } from './scriptDebugHelpers.js'
import ScriptCodeEditor from './ScriptCodeEditor.vue'

const NODE_PREVIEW_LIMIT = 180
const MAX_UNDO_STEPS = 40
const SCRIPT_SNIPPETS = [
  { label: '位置', code: 'setPosition(0, 0, 0);' },
  { label: '旋转', code: 'setRotationDeg(0, 0, 0);' },
  { label: '缩放', code: 'setScale(1, 1, 1);' },
  { label: '角度', code: 'node.rotation.y = deg(15);' },
]
const SCRIPT_DIALOG_RESIZE_HANDLES = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw']
const canvasHost = ref(null)
const viewerPanelRef = ref(null)
const nodeListRef = ref(null)
const scriptEditorRef = ref(null)
const scriptUploadInputRef = ref(null)
const status = ref('正在加载默认模型 ZF18000.glb')
const isLoading = ref(false)
const modelReady = ref(false)
const modelInfo = ref(null)
const nodeRows = ref([])
const nodeKeyword = ref('')
const selectedNodeUuid = ref('')
const transformDraft = ref(createEmptyTransform())
const showTransformGizmo = ref(true)
const transformControlMode = ref(DEFAULT_TRANSFORM_MODE)
const cameraMode = ref(CAMERA_MODES.PERSPECTIVE)
const motionProgress = ref(0)
const isMotionPlaying = ref(false)
const motionMessage = ref('动作演示会按节点名称驱动，不使用手动标点。')
const startPose = ref(null)
const endPose = ref(null)
const isWireframe = ref(false)
const showGrid = ref(true)
const showModel = ref(true)
const isModelTransparent = ref(false)
const draggedNodeUuid = ref('')
const dragOverNodeUuid = ref('')
const dragOverPlacement = ref('')
const collapsedNodeUuids = ref(new Set())
const hiddenNodeUuids = ref(new Set())
const isSearchModelOnly = ref(false)
const undoStack = ref([])
const structurePanelWidth = ref(440)
const nodeContextMenu = ref(createClosedNodeContextMenu())
const scriptDialog = ref(createClosedScriptDialog())
const scriptDialogLayout = ref(createDefaultScriptDialogLayout())
const scriptDialogMaximizedLayout = ref(createDefaultScriptDialogLayout())
const hasScriptDialogLayout = ref(false)
const selectedScriptLibraryId = ref(SCRIPT_LIBRARY_ITEMS[0]?.id ?? '')
const scriptDialogDrag = ref(createDialogDragState())
const scriptDialogResize = ref(createDialogResizeState())
const infoDialog = ref(createClosedInfoDialog())
const nodeSelectionScrollState = createNodeSelectionScrollState()

let scene
let camera
let renderer
let controls
let transformControls
let transformControlsHelper
let raycaster
let pointer
let pickStart = null
let grid
let loader
let resizeObserver
let frameId = 0
let currentModel = null
let currentGltfMeta = { animations: [] }
let currentFileMeta = { name: 'model.glb', size: 0 }
let currentModelSource = null
let originalNodeTransforms = new Map()
let originalModelEditState = null
let motionStartedAt = 0
let isApplyingMotion = false
let lastBox = null
let selectionBox = null
let materialStates = new Map()
let isResizingStructurePanel = false
let isUndoingModelEdit = false
let sessionSaveTimer = 0
let didTransformControlChange = false

const visibleNodeRows = computed(() =>
  filterCollapsedNodeRows(nodeRows.value, collapsedNodeUuids.value)
)
const filteredNodeRows = computed(() =>
  filterNodeRowsByKeyword(visibleNodeRows.value, nodeKeyword.value)
)
const nodePreviewRows = computed(() => filteredNodeRows.value.slice(0, NODE_PREVIEW_LIMIT))
const hasNodeKeyword = computed(() => Boolean(nodeKeyword.value.trim()))
const selectedNode = computed(
  () => nodeRows.value.find((node) => node.uuid === selectedNodeUuid.value) ?? null
)
const collapsibleNodeRows = computed(() => nodeRows.value.filter(canCollapseNode))
const hasExpandedCollapsibleNodes = computed(() =>
  collapsibleNodeRows.value.some((node) => !collapsedNodeUuids.value.has(node.uuid))
)
const roleSummaryRows = computed(() =>
  MECHANISM_ROLES.map((role) => ({
    ...role,
    nodeCount: nodeRows.value.filter((node) => node.mechanismRole?.key === role.key).length,
  })).filter((role) => role.nodeCount > 0)
)
const allNodesHidden = computed(() => areAllNodesHidden(currentModel, hiddenNodeUuids.value))
const effectivelyHiddenNodeUuids = computed(() =>
  collectEffectivelyHiddenNodeUuids(currentModel, hiddenNodeUuids.value)
)
const nodeContextMenuItems = computed(() => getNodeContextMenuItems())
const activeInfoNode = computed(
  () => nodeRows.value.find((node) => node.uuid === infoDialog.value.nodeUuid) ?? null
)
const activeInfoSections = computed(() => createNodeInfoSections(activeInfoNode.value))
const activeScriptEntry = computed(
  () =>
    scriptDialog.value.scripts.find((item) => item.id === scriptDialog.value.activeScriptId) ?? null
)
const activeScriptLocked = computed(() => Boolean(activeScriptEntry.value?.locked))
const activeScriptIsLookAt = computed(() => isLookAtScriptName(activeScriptEntry.value?.name))
const selectedScriptLibraryItem = computed(
  () => SCRIPT_LIBRARY_ITEMS.find((item) => item.id === selectedScriptLibraryId.value) ?? null
)
const scriptDialogMessageClass = computed(() => ({
  error: scriptDialog.value.messageType === 'error',
  success: scriptDialog.value.messageType === 'success',
}))
const scriptEditorStats = computed(() => createCodeStats(scriptDialog.value.script))
const transformDisplayRows = computed(() => createTransformDisplayRows(transformDraft.value))
const canUsePoseMotion = computed(() => Boolean(startPose.value && endPose.value))
const cameraModeButtonLabel = computed(() =>
  cameraMode.value === CAMERA_MODES.ORTHOGRAPHIC ? '切换透视' : '切换正交'
)
const cameraModeText = computed(() =>
  cameraMode.value === CAMERA_MODES.ORTHOGRAPHIC ? '正交' : '透视'
)
const appShellStyle = computed(() => ({
  '--structure-panel-width': `${structurePanelWidth.value}px`,
}))
const scriptDialogStyle = computed(() => {
  const layout = scriptDialog.value.maximized
    ? scriptDialogMaximizedLayout.value
    : scriptDialogLayout.value

  return {
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
  }
})
const scriptDialogBadgeStyle = computed(() => {
  const bounds = getViewerPanelBounds()
  return {
    right: `${Math.max(16, window.innerWidth - bounds.x - bounds.width + 16)}px`,
    bottom: `${Math.max(16, window.innerHeight - bounds.y - bounds.height + 16)}px`,
  }
})

function countTriangles(object) {
  let triangles = 0

  object.traverse((child) => {
    if (child.isMesh) {
      const geometry = child.geometry

      if (geometry.index) {
        triangles += geometry.index.count / 3
      } else {
        triangles += geometry.attributes.position.count / 3
      }
    }
  })

  return triangles
}
onMounted(() => {
  setupScene()
  resizeObserver = new ResizeObserver(resizeRenderer)
  resizeObserver.observe(canvasHost.value)
  animate()
  loadDefaultModel()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  renderer?.domElement?.removeEventListener('pointerdown', handleCanvasPointerDown)
  renderer?.domElement?.removeEventListener('pointerup', handleCanvasPointerUp)
  window.removeEventListener('pointermove', handleStructureResizeMove)
  window.removeEventListener('pointerup', stopStructureResize)
  window.removeEventListener('pointermove', handleScriptDialogDragMove)
  window.removeEventListener('pointerup', stopScriptDialogDrag)
  window.removeEventListener('pointermove', handleScriptDialogResizeMove)
  window.removeEventListener('pointerup', stopScriptDialogResize)
  cancelScheduledSessionSave()
  transformControls?.dispose()
  controls?.dispose()
  disposeCurrentModel()
  renderer?.dispose()
})

watch(nodeKeyword, (keyword) => {
  if (!keyword.trim() && isSearchModelOnly.value) {
    isSearchModelOnly.value = false
  }
  if (currentModel) applyModelAppearance()
})

watch(
  [selectedNodeUuid, nodePreviewRows],
  () => {
    if (!consumeNodeSelectionScrollRequest(nodeSelectionScrollState)) return
    scrollSelectedNodeIntoView()
  },
  { flush: 'post' }
)

watch(
  () => [
    scriptDialog.value.activeScriptId,
    scriptDialog.value.script,
    scriptDialog.value.scriptName,
  ],
  () => {
    syncScriptDialogActiveEntry()
  }
)

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.glb')) {
    status.value = '请选择 .glb 文件'
    return
  }

  isLoading.value = true
  status.value = `正在读取 ${file.name}`

  try {
    const arrayBuffer = await file.arrayBuffer()
    parseGlb(arrayBuffer, file)
  } catch (error) {
    isLoading.value = false
    status.value = `读取失败：${error.message}`
  } finally {
    event.target.value = ''
  }
}

async function loadDefaultModel() {
  isLoading.value = true
  status.value = '正在加载默认模型 ZF18000.glb'

  try {
    const response = await fetch(defaultModelUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    parseGlb(arrayBuffer, {
      name: 'ZF18000.glb',
      size: Number(response.headers.get('content-length')) || arrayBuffer.byteLength,
    })
  } catch (error) {
    isLoading.value = false
    status.value = `默认模型加载失败：${error.message}。也可以手动选择 .glb 文件。`
  }
}

function parseGlb(arrayBuffer, file, options = {}) {
  const restoreSession = options.restoreSession ?? true
  const rememberSource = options.rememberSource ?? true
  const fileMeta = {
    name: file?.name ?? 'model.glb',
    size: file?.size ?? arrayBuffer.byteLength,
  }
  const sourceBuffer = rememberSource ? arrayBuffer.slice(0) : null

  loader.parse(
    arrayBuffer,
    '',
    (gltf) => {
      disposeCurrentModel()

      currentModel = gltf.scene
      currentGltfMeta = gltf
      currentFileMeta = fileMeta

      if (rememberSource) {
        currentModelSource = {
          arrayBuffer: sourceBuffer,
          file: fileMeta,
        }
      }
      scene.add(currentModel)
      prepareMaterialStates(currentModel)
      currentModel.updateWorldMatrix(true, true)
      const { sessionResult, meshObjectResult } = prepareLoadedModelStructure(
        currentModel,
        restoreSession ? restoreCurrentSessionState : undefined
      )

      modelInfo.value = collectModelInfo(currentModel, currentGltfMeta, currentFileMeta)
      nodeRows.value = collectRoleNodeRows(currentModel)
      captureCurrentModelInitialState()
      motionProgress.value = 0
      isMotionPlaying.value = false
      startPose.value = null
      endPose.value = null
      undoStack.value = []
      motionMessage.value = '动作演示会按节点名称驱动，不使用手动标点。'
      selectedNodeUuid.value = findObjectByUuid(selectedNodeUuid.value)
        ? selectedNodeUuid.value
        : (nodeRows.value[0]?.uuid ?? '')
      modelReady.value = nodeRows.value.length > 0
      pruneCollapsedNodeUuids()
      pruneHiddenNodeUuids()

      fitCameraToModel(currentModel)
      applyModelAppearance()
      syncTransformDraftFromSelection()
      updateSelectionBox()

      isLoading.value = false
      const meshObjectMessage =
        meshObjectResult.created > 0 ? `，已自动新增 ${meshObjectResult.created} 个 Object3D` : ''
      status.value =
        sessionResult.restored > 0
          ? `加载成功：${fileMeta.name}，已恢复当前会话保存的模型编辑${meshObjectMessage}`
          : options.successMessage ||
            `加载成功：${fileMeta.name}，共 ${nodeRows.value.length} 个节点${meshObjectMessage}`
    },
    (error) => {
      isLoading.value = false
      status.value = `模型解析失败：${error.message}`
    }
  )
}

function setupScene() {
  scene = new Scene()
  scene.background = new Color('#0f172a')

  camera = createViewerCamera(CAMERA_MODES.PERSPECTIVE)
  cameraMode.value = CAMERA_MODES.PERSPECTIVE

  renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = LinearToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  canvasHost.value.appendChild(renderer.domElement)
  renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown)
  renderer.domElement.addEventListener('pointerup', handleCanvasPointerUp)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.setMode(transformControlMode.value)
  transformControls.setSize(0.85)
  transformControls.addEventListener('dragging-changed', handleTransformControlDragging)
  transformControls.addEventListener('mouseDown', handleTransformControlMouseDown)
  transformControls.addEventListener('objectChange', handleTransformControlObjectChange)
  transformControlsHelper = transformControls.getHelper()
  transformControlsHelper.visible = false
  scene.add(transformControlsHelper)

  const ambientLight = new AmbientLight('#fff7ed', 1.6)
  scene.add(ambientLight)

  const hemiLight = new HemisphereLight('#f8fafc', '#475569', 3.2)
  scene.add(hemiLight)

  const keyLight = new DirectionalLight('#ffffff', 3.8)
  keyLight.position.set(6, 8, 5)
  scene.add(keyLight)

  const fillLight = new DirectionalLight('#dbeafe', 2.4)
  fillLight.position.set(-6, 4, 7)
  scene.add(fillLight)

  const rimLight = new DirectionalLight('#fde68a', 1.8)
  rimLight.position.set(3, 10, -6)
  scene.add(rimLight)

  grid = new GridHelper(10, 20, '#475569', '#334155')
  grid.position.y = -0.02
  scene.add(grid)

  loader = new GLTFLoader()
  raycaster = new Raycaster()
  pointer = new Vector2()
  resizeRenderer()
}

function animate() {
  frameId = requestAnimationFrame(animate)
  updateMotionPlayback()
  controls?.update()
  renderer?.render(scene, camera)
}

function resizeRenderer() {
  if (!renderer || !camera || !canvasHost.value) return

  const { clientWidth, clientHeight } = canvasHost.value
  if (clientWidth === 0 || clientHeight === 0) return

  renderer.setSize(clientWidth, clientHeight, false)
  updateViewerCameraProjection(camera, {
    width: clientWidth,
    height: clientHeight,
    target: controls?.target,
  })
}

function currentCanvasAspect() {
  if (!canvasHost.value) return 1

  const { clientWidth, clientHeight } = canvasHost.value
  return clientWidth > 0 && clientHeight > 0 ? clientWidth / clientHeight : 1
}

function refreshStructure() {
  if (!currentModel) {
    status.value = '请先加载模型'
    return
  }

  currentModel.updateWorldMatrix(true, true)
  modelInfo.value = collectModelInfo(currentModel, currentGltfMeta, currentFileMeta)
  nodeRows.value = collectRoleNodeRows(currentModel)
  pruneCollapsedNodeUuids()
  applyModelAppearance()
  if (!nodeRows.value.some((node) => node.uuid === selectedNodeUuid.value)) {
    selectedNodeUuid.value = nodeRows.value[0]?.uuid ?? ''
  }
  updateSelectionBox()
  status.value = `结构已刷新：共 ${nodeRows.value.length} 个节点`
}

function exportStructure() {
  if (!currentModel || !modelInfo.value || nodeRows.value.length === 0) {
    status.value = '请先加载模型'
    return
  }

  const payload = createStructureExport({
    modelInfo: modelInfo.value,
    nodes: nodeRows.value,
  })
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${modelInfo.value.fileName.replace(/\.glb$/i, '') || 'model'}-structure.json`
  link.click()
  URL.revokeObjectURL(url)
  status.value = `模型结构已导出：${payload.nodeCount} 个节点`
}

function exportPose() {
  if (!currentModel || !modelInfo.value || nodeRows.value.length === 0) {
    status.value = '请先加载模型'
    return
  }

  refreshStructureAfterTransform()
  const payload = createPoseExport({
    modelName: modelInfo.value.fileName,
    nodes: nodeRows.value,
  })
  downloadJson(payload, `${modelInfo.value.fileName.replace(/\.glb$/i, '') || 'model'}-pose.json`)
  status.value = `当前姿态已导出：${payload.nodeCount} 个节点`
}

async function exportEditedModel() {
  stopMotionPlayback()
  if (!currentModel || !modelInfo.value) {
    status.value = '请先加载模型'
    return
  }

  try {
    status.value = '正在导出模型...'
    currentModel.updateWorldMatrix?.(true, true)
    refreshStructureAfterTransform()
    const payload = await exportModelAsGlb(currentModel)
    const fileName = createEditedGlbFileName(modelInfo.value.fileName)
    downloadBinary(payload, fileName, 'model/gltf-binary')
    status.value = `模型已导出：${fileName}`
  } catch (error) {
    console.error(error)
    status.value = '模型导出失败'
  }
}

function downloadJson(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function downloadBinary(payload, fileName, type) {
  const blob = new Blob([payload], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function selectNode(uuid, { scrollIntoView = false } = {}) {
  const object = findObjectByUuid(uuid)
  if (isNodeEffectivelyHidden(object, hiddenNodeUuids.value, currentModel)) {
    status.value = '隐藏节点不可选中'
    return
  }

  const isSameSelection = selectedNodeUuid.value === uuid
  requestNodeSelectionScroll(nodeSelectionScrollState, scrollIntoView)
  selectedNodeUuid.value = uuid
  resetTransformModeForSelection()
  syncTransformDraftFromSelection()
  updateSelectionBox()
  closeContextMenu()
  if (scriptDialog.value.open) {
    updateScriptDialogForNode(uuid)
  }

  if (scrollIntoView && isSameSelection) {
    scrollSelectedNodeIntoView()
  }
}

async function copyNodeName(node) {
  const result = await copyNodeNameToClipboard(node, getBrowserClipboard())
  status.value = result.ok ? `已复制节点名称：${result.text}` : result.error
}

function addPartObject3D(parent = currentModel, options = {}) {
  stopMotionPlayback()
  if (!currentModel) {
    status.value = '请先加载模型'
    return
  }

  const targetParent = parent?.isObject3D ? parent : currentModel
  pushModelHistory()
  const object = createPartObject3D(currentModel, targetParent, options)
  selectedNodeUuid.value = object.uuid
  resetTransformModeForSelection()
  captureCurrentModelInitialState()
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = `已在 ${targetParent.name || '模型根节点'} 下新增 Object3D：${object.name}`
  saveCurrentSessionState()
}

function addPartObject3DToNode(uuid) {
  const sibling = findObjectByUuid(uuid)
  if (!sibling) {
    status.value = '没有找到要新建 Object3D 的参考节点'
    return
  }

  stopMotionPlayback()
  if (!currentModel) {
    status.value = '请先加载模型'
    return
  }

  pushModelHistory()
  const object = createSiblingPartObject3D(currentModel, sibling)
  selectedNodeUuid.value = object.uuid
  resetTransformModeForSelection()
  captureCurrentModelInitialState()
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = `已在 ${sibling.name || '(未命名)'} 同级新增 Object3D：${object.name}`
  saveCurrentSessionState()
}

function initializeMeshObjects() {
  stopMotionPlayback()
  if (!currentModel) {
    status.value = '请先加载模型'
    return
  }

  pushModelHistory()
  const result = initializeMeshObject3Ds(currentModel)
  if (result.created > 0) {
    captureCurrentModelInitialState()
  }
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = `初始化 Object 完成：新增 ${result.created} 个，跳过 ${result.skipped} 个`
  saveCurrentSessionState()
}

function canRenameNode(node) {
  return isViewerCreatedObject3D(findObjectByUuid(node.uuid))
}

function renameNodeFromEvent(node, event) {
  const object = findObjectByUuid(node.uuid)
  if (String(event.target.value ?? '').trim()) pushModelHistory()
  const result = renameCreatedObject3D(currentModel, object, event.target.value)
  if (!result.ok) {
    event.target.value = node.displayName
    status.value = result.reason
    return
  }

  selectedNodeUuid.value = object.uuid
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = `已重命名 Object3D：${result.name}`
  saveCurrentSessionState()
}

function pushModelHistory() {
  if (!currentModel || isUndoingModelEdit) return

  const nextStack = [...undoStack.value, captureModelEditState(currentModel)]
  undoStack.value = nextStack.slice(-MAX_UNDO_STEPS)
}

function undoModelEdit() {
  if (!currentModel || undoStack.value.length === 0) {
    status.value = '没有可返回的上一步'
    return
  }

  const previousState = undoStack.value.at(-1)
  undoStack.value = undoStack.value.slice(0, -1)
  isUndoingModelEdit = true
  try {
    restoreModelEditState(currentModel, previousState)
  } finally {
    isUndoingModelEdit = false
  }

  if (!findObjectByUuid(selectedNodeUuid.value)) {
    selectedNodeUuid.value = currentModel.uuid
  }
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = '已返回上一步'
  saveCurrentSessionState()
}

function captureCurrentModelInitialState() {
  if (!currentModel) {
    originalNodeTransforms = new Map()
    originalModelEditState = null
    return
  }

  originalNodeTransforms = captureOriginalNodeTransforms(currentModel)
  originalModelEditState = captureModelEditState(currentModel)
}

function restoreCurrentModelInitialState() {
  if (!currentModel) return { restored: 0 }

  if (originalModelEditState) {
    return restoreModelEditState(currentModel, originalModelEditState)
  }

  return { restored: resetAllNodeTransforms(currentModel, originalNodeTransforms) }
}

function resetSelectedNodeTransform() {
  const object = findObjectByUuid(selectedNodeUuid.value)
  if (!currentModel || !object) {
    status.value = '请先选择节点'
    return
  }

  pushModelHistory()
  if (!resetNodeTransform(object, originalNodeTransforms)) {
    undoStack.value = undoStack.value.slice(0, -1)
    status.value = '当前节点没有可重置的初始状态'
    return
  }

  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = `已局部重置：${object.name || '(未命名)'}`
  saveCurrentSessionState()
}

function resetModelTransform() {
  if (!currentModel) {
    status.value = '请先加载模型'
    return
  }

  pushModelHistory()
  const result = restoreCurrentModelInitialState()
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = `已重置模型：${result.restored} 个节点`
  saveCurrentSessionState()
}

function reloadCurrentModelSource() {
  if (!currentModelSource?.arrayBuffer) {
    status.value = '没有可重读的模型数据'
    return
  }

  stopMotionPlayback()
  const fileName = currentModelSource.file?.name || currentSessionModelName()
  clearModelSessionState(getBrowserSessionStorage(), currentSessionModelName())
  isLoading.value = true
  status.value = `正在重读模型：${fileName}`
  parseGlb(currentModelSource.arrayBuffer.slice(0), currentModelSource.file, {
    restoreSession: false,
    rememberSource: false,
    successMessage: `已重读模型：${fileName}，已恢复原始位置`,
  })
}

function canDragNode(node) {
  return Boolean(modelReady.value && currentModel && node.uuid !== currentModel.uuid)
}

function canDropOnNode(node) {
  const sourceNode = nodeRows.value.find((row) => row.uuid === draggedNodeUuid.value) ?? {
    uuid: draggedNodeUuid.value,
  }
  const placement = dragOverPlacement.value || NODE_DROP_PLACEMENTS.INSIDE
  return canDropOnNodeAtPlacement(sourceNode, node, placement)
}

function canDropOnNodeAtPlacement(sourceNode, targetNode, placement) {
  if (!modelReady.value || !currentModel) return false
  if (placement === NODE_DROP_PLACEMENTS.INSIDE) {
    return canDropNodeOnTarget(sourceNode, targetNode)
  }

  return Boolean(
    sourceNode?.uuid &&
    targetNode?.uuid &&
    sourceNode.uuid !== targetNode.uuid &&
    targetNode.depth > 0
  )
}

function isNodeDropPlacement(node, placement) {
  return dragOverNodeUuid.value === node.uuid && dragOverPlacement.value === placement
}

function canCollapseNode(node) {
  return node.type === 'Object3D' && node.childCount > 0
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
  status.value = nextCollapsed.has(node.uuid)
    ? `已折叠 Object3D：${node.displayName}`
    : `已展开 Object3D：${node.displayName}`
}

function toggleAllNodeCollapse() {
  const collapsibleNodes = nodeRows.value.filter(canCollapseNode)
  if (!collapsibleNodes.length) {
    status.value = '当前没有可收起的 Object3D'
    return
  }

  const shouldCollapse = collapsibleNodes.some((node) => !collapsedNodeUuids.value.has(node.uuid))
  collapsedNodeUuids.value = shouldCollapse
    ? new Set(collapsibleNodes.map((node) => node.uuid))
    : new Set()
  status.value = shouldCollapse
    ? `已收起 ${collapsibleNodes.length} 个 Object3D`
    : '已展开全部模型节点'
}

function isNodeHidden(node) {
  return effectivelyHiddenNodeUuids.value.has(node.uuid)
}

function toggleNodeVisibility(node) {
  const object = findObjectByUuid(node.uuid)
  if (!object || object === currentModel) return

  const wasHidden = isNodeEffectivelyHidden(object, hiddenNodeUuids.value, currentModel)
  hiddenNodeUuids.value = toggleHiddenNode(object, hiddenNodeUuids.value)
  applyModelAppearance()

  if (
    isNodeEffectivelyHidden(
      findObjectByUuid(selectedNodeUuid.value),
      hiddenNodeUuids.value,
      currentModel
    )
  ) {
    selectedNodeUuid.value = ''
    syncTransformDraftFromSelection()
    updateSelectionBox()
  }

  const isHidden = isNodeEffectivelyHidden(object, hiddenNodeUuids.value, currentModel)
  if (isHidden) {
    status.value =
      wasHidden && !hiddenNodeUuids.value.has(node.uuid)
        ? `父级已隐藏，当前节点仍不可见：${node.displayName}`
        : `已隐藏节点：${node.displayName}`
  } else {
    status.value = `已显示节点：${node.displayName}`
  }
  saveCurrentSessionState()
}

function toggleAllNodesVisibility() {
  if (!currentModel) {
    status.value = '请先加载模型'
    return
  }

  if (allNodesHidden.value) {
    hiddenNodeUuids.value = new Set()
    applyModelAppearance()
    status.value = '已展示全部节点'
    saveCurrentSessionState()
    return
  }

  hiddenNodeUuids.value = createAllHiddenNodeSet(currentModel)
  applyModelAppearance()
  if (
    isNodeEffectivelyHidden(
      findObjectByUuid(selectedNodeUuid.value),
      hiddenNodeUuids.value,
      currentModel
    )
  ) {
    selectedNodeUuid.value = ''
    syncTransformDraftFromSelection()
    updateSelectionBox()
  }
  status.value = `已隐藏全部节点：${hiddenNodeUuids.value.size} 个`
  saveCurrentSessionState()
}

function toggleSearchModelOnly() {
  if (!hasNodeKeyword.value) return

  isSearchModelOnly.value = !isSearchModelOnly.value
  applyModelAppearance()
  status.value = isSearchModelOnly.value
    ? `已只显示搜索匹配模型：${filteredNodeRows.value.length} 个节点`
    : '已恢复显示完整模型'
}

function setTransformControlMode(mode) {
  transformControlMode.value = normalizeTransformMode(mode)
  updateTransformControls()
}

function resetTransformModeForSelection() {
  transformControlMode.value = DEFAULT_TRANSFORM_MODE
}

function handleNodeContextMenu(event, node) {
  nodeContextMenu.value = openNodeContextMenu(nodeContextMenu.value, {
    nodeUuid: node.uuid,
    x: event.clientX,
    y: event.clientY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    menuWidth: 160,
    menuHeight: 176,
  })
}

function closeContextMenu() {
  if (!nodeContextMenu.value.open) return
  nodeContextMenu.value = closeNodeContextMenu()
}

function handleContextMenuAction(action) {
  const uuid = nodeContextMenu.value.nodeUuid
  closeContextMenu()

  if (action === 'create-object3d') addPartObject3DToNode(uuid)
  if (action === 'edit-script') openScriptDialog(uuid)
  if (action === 'show-info') openInfoDialog(uuid)
  if (action === 'delete') deleteNodeByUuid(uuid)
  if (action === 'focus') focusNodeByUuid(uuid)
}

function openInfoDialog(uuid) {
  const row = nodeRows.value.find((node) => node.uuid === uuid)
  if (!row) return

  infoDialog.value = {
    open: true,
    nodeUuid: uuid,
    collapsed: new Set(),
  }
}

function closeInfoDialog() {
  infoDialog.value = createClosedInfoDialog()
}

function isInfoSectionCollapsed(key) {
  return infoDialog.value.collapsed.has(key)
}

function toggleInfoSection(key) {
  const collapsed = new Set(infoDialog.value.collapsed)
  if (collapsed.has(key)) {
    collapsed.delete(key)
  } else {
    collapsed.add(key)
  }
  infoDialog.value = {
    ...infoDialog.value,
    collapsed,
  }
}

function deleteNodeByUuid(uuid) {
  const object = findObjectByUuid(uuid)
  if (!object) return

  pushModelHistory()
  const result = deleteCreatedObject3D(currentModel, object)
  if (!result.ok) {
    undoStack.value = undoStack.value.slice(0, -1)
    status.value = result.reason
    return
  }

  if (selectedNodeUuid.value === uuid) {
    selectedNodeUuid.value = ''
  }
  hiddenNodeUuids.value = new Set(
    [...hiddenNodeUuids.value].filter((hiddenUuid) => hiddenUuid !== uuid)
  )
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = `已删除节点：${object.name || '(未命名)'}`
  saveCurrentSessionState()
}

function focusNodeByUuid(uuid) {
  const object = findObjectByUuid(uuid)
  if (!object) return

  const target = createNodeFocusTarget(object, camera)
  if (!applyNodeFocusTarget(camera, controls, target)) {
    status.value = '无法聚焦该节点。'
    return
  }
  status.value = `已聚焦节点：${object.name || '(未命名)'}`
}

function startStructureResize(event) {
  if (window.innerWidth <= 980) return

  isResizingStructurePanel = true
  window.addEventListener('pointermove', handleStructureResizeMove)
  window.addEventListener('pointerup', stopStructureResize)
  handleStructureResizeMove(event)
}

function handleStructureResizeMove(event) {
  if (!isResizingStructurePanel) return
  structurePanelWidth.value = clampPanelWidth(event.clientX)
}

function stopStructureResize() {
  isResizingStructurePanel = false
  window.removeEventListener('pointermove', handleStructureResizeMove)
  window.removeEventListener('pointerup', stopStructureResize)
}

function handleNodeDragStart(event, uuid) {
  if (!currentModel || uuid === currentModel.uuid) {
    event.preventDefault()
    return
  }

  draggedNodeUuid.value = uuid
  dragOverPlacement.value = ''
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', uuid)
}

function handleNodeDragOver(event, node) {
  const placement = getNodeDropPlacement(
    event.clientY,
    event.currentTarget?.getBoundingClientRect?.()
  )
  const sourceNode = nodeRows.value.find((row) => row.uuid === draggedNodeUuid.value) ?? {
    uuid: draggedNodeUuid.value,
  }
  if (!canDropOnNodeAtPlacement(sourceNode, node, placement)) {
    if (dragOverNodeUuid.value === node.uuid) {
      dragOverNodeUuid.value = ''
      dragOverPlacement.value = ''
    }
    return
  }

  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOverNodeUuid.value = node.uuid
  dragOverPlacement.value = placement
}

function handleNodeDragLeave(node) {
  if (dragOverNodeUuid.value === node.uuid) {
    dragOverNodeUuid.value = ''
    dragOverPlacement.value = ''
  }
}

function handleNodeDragEnd() {
  draggedNodeUuid.value = ''
  dragOverNodeUuid.value = ''
  dragOverPlacement.value = ''
}

function handleNodeDrop(event, targetUuid) {
  event.preventDefault()
  const sourceUuid = event.dataTransfer.getData('text/plain') || draggedNodeUuid.value
  const placement =
    dragOverNodeUuid.value === targetUuid
      ? dragOverPlacement.value
      : getNodeDropPlacement(event.clientY, event.currentTarget?.getBoundingClientRect?.())
  draggedNodeUuid.value = ''
  dragOverNodeUuid.value = ''
  dragOverPlacement.value = ''

  if (!currentModel || !sourceUuid || !targetUuid || sourceUuid === targetUuid) return

  stopMotionPlayback()
  const source = findObjectByUuid(sourceUuid)
  const target = findObjectByUuid(targetUuid)
  pushModelHistory()
  const result =
    placement === NODE_DROP_PLACEMENTS.INSIDE
      ? moveNodeToObject3D(currentModel, source, target)
      : moveNodeNextToObject3D(currentModel, source, target, placement)
  if (!result.ok) {
    undoStack.value = undoStack.value.slice(0, -1)
    status.value = result.reason
    return
  }

  selectedNodeUuid.value = placement === NODE_DROP_PLACEMENTS.INSIDE ? target.uuid : source.uuid
  resetTransformModeForSelection()
  captureCurrentModelInitialState()
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  status.value = createNodeDropStatus(source, target, placement, result.moved)
  saveCurrentSessionState()
}

function createNodeDropStatus(source, target, placement, moved) {
  const sourceName = source?.name || '(未命名)'
  const targetName = target?.name || '(未命名)'

  if (placement === NODE_DROP_PLACEMENTS.BEFORE) {
    return moved
      ? `已把 ${sourceName} 移到 ${targetName} 前面`
      : `${sourceName} 已在 ${targetName} 前面`
  }
  if (placement === NODE_DROP_PLACEMENTS.AFTER) {
    return moved
      ? `已把 ${sourceName} 移到 ${targetName} 后面`
      : `${sourceName} 已在 ${targetName} 后面`
  }

  return moved ? `已把 ${sourceName} 放入 ${targetName}` : `${sourceName} 已在 ${targetName} 中`
}

function syncTransformDraftFromSelection() {
  const object = findObjectByUuid(selectedNodeUuid.value)
  if (!object) {
    transformDraft.value = createEmptyTransform()
    return
  }

  transformDraft.value = cloneTransform(readNodeTransform(object))
}

function scrollSelectedNodeIntoView() {
  nextTick(() => {
    const list = nodeListRef.value
    if (!list) return

    const activeItem = list.querySelector('li.active')
    if (!activeItem) return

    activeItem.scrollIntoView({ block: 'center' })
  })
}

function createScriptDialogStateForObject(object, row) {
  return createNodeScriptDialogState({
    nodeUuid: object.uuid,
    node: object,
    row,
    transform: cloneTransform(readNodeTransform(object)),
  })
}

function openScriptDialog(uuid) {
  if (!updateScriptDialogForNode(uuid)) return

  if (!hasScriptDialogLayout.value) {
    scriptDialogLayout.value = createInitialScriptDialogLayout()
    hasScriptDialogLayout.value = true
  }
  scriptDialog.value = {
    ...scriptDialog.value,
    minimized: false,
  }
  scriptDialogLayout.value = clampScriptDialogLayout(scriptDialogLayout.value)
}

function updateScriptDialogForNode(uuid) {
  const object = findObjectByUuid(uuid)
  const row = nodeRows.value.find((node) => node.uuid === uuid)
  if (!object || !row) return false

  const currentState = scriptDialog.value
  scriptDialog.value = createScriptDialogStateForObject(object, row)
  scriptDialog.value = {
    ...scriptDialog.value,
    minimized: currentState.minimized,
    transparent: currentState.transparent,
    maximized: false,
  }
  return true
}

function getScriptDialogActiveEntryIndex() {
  return scriptDialog.value.scripts.findIndex(
    (item) => item.id === scriptDialog.value.activeScriptId
  )
}

function getScriptDialogActiveEntry() {
  const index = getScriptDialogActiveEntryIndex()
  return index >= 0 ? scriptDialog.value.scripts[index] : null
}

function syncScriptDialogActiveEntry() {
  const entry = getScriptDialogActiveEntry()
  if (!entry) return

  entry.script = scriptDialog.value.script
  entry.name = scriptDialog.value.scriptName
}

function setScriptDialogActiveEntryLocked(locked) {
  const entry = getScriptDialogActiveEntry()
  if (!entry) return null

  entry.locked = locked
  scriptDialog.value = {
    ...scriptDialog.value,
    scripts: [...scriptDialog.value.scripts],
  }
  return entry
}

function selectScriptDialogScript(scriptId) {
  const entry = scriptDialog.value.scripts.find((item) => item.id === scriptId)
  if (!entry) return

  syncScriptDialogActiveEntry()
  scriptDialog.value = {
    ...scriptDialog.value,
    activeScriptId: entry.id,
    script: entry.script,
    scriptName: entry.name,
  }
}

function createScriptDialogEntry() {
  if (activeScriptLocked.value) {
    updateScriptDialogMessage('请先解锁脚本，再新建脚本。', 'error')
    return
  }

  const object = findObjectByUuid(scriptDialog.value.nodeUuid)
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error')
    return
  }

  syncScriptDialogActiveEntry()

  const entry = createControlScriptEntry({
    name: `脚本 ${scriptDialog.value.scripts.length + 1}`,
    script: createTransformScript(readNodeTransform(object)),
  })
  const scripts = [...scriptDialog.value.scripts, entry]
  scriptDialog.value = {
    ...scriptDialog.value,
    scripts,
    activeScriptId: entry.id,
    script: entry.script,
    scriptName: entry.name,
  }
  updateScriptDialogMessage(`已新建脚本：${entry.name}`, 'success')
  status.value = scriptDialog.value.message
}

function deleteScriptDialogEntry() {
  if (activeScriptLocked.value) {
    updateScriptDialogMessage('请先解锁脚本，再删除脚本。', 'error')
    return
  }

  const object = findObjectByUuid(scriptDialog.value.nodeUuid)
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error')
    return
  }

  if (scriptDialog.value.scripts.length <= 1) {
    updateScriptDialogMessage('至少保留一个脚本，想清空请点“清除绑定”。', 'error')
    return
  }

  syncScriptDialogActiveEntry()

  const index = getScriptDialogActiveEntryIndex()
  if (index < 0) {
    updateScriptDialogMessage('请先选择脚本。', 'error')
    return
  }

  const removedEntry = scriptDialog.value.scripts[index]
  const scripts = scriptDialog.value.scripts.filter((_, scriptIndex) => scriptIndex !== index)
  const nextEntry = scripts[Math.min(index, scripts.length - 1)]
  scriptDialog.value = {
    ...scriptDialog.value,
    scripts,
    activeScriptId: nextEntry.id,
    script: nextEntry.script,
    scriptName: nextEntry.name,
  }
  updateScriptDialogMessage(`已删除脚本：${removedEntry.name || '未命名'}`, 'success')
  status.value = scriptDialog.value.message
}

async function importSelectedScriptLibraryItem() {
  const item = selectedScriptLibraryItem.value
  if (!item) {
    updateScriptDialogMessage('请先选择一个内置脚本。', 'error')
    return
  }

  try {
    const source = await loadScriptLibraryItemSource(item)
    addScriptDialogEntryFromSource({
      name: item.name,
      script: source,
      successLabel: `内置脚本：${item.name}`,
    })
  } catch (error) {
    updateScriptDialogMessage(`读取内置脚本失败：${error?.message ?? String(error)}`, 'error')
  }
}

function openScriptUploadPicker() {
  if (activeScriptLocked.value) {
    updateScriptDialogMessage('请先解锁脚本，再上传 JS。', 'error')
    return
  }

  scriptUploadInputRef.value?.click()
}

async function handleScriptUpload(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.js')) {
    updateScriptDialogMessage('请选择 .js 文件。', 'error')
    return
  }

  try {
    const source = await file.text()
    addScriptDialogEntryFromSource({
      name: createScriptNameFromFileName(file.name),
      script: source,
      successLabel: `上传脚本：${file.name}`,
    })
  } catch (error) {
    updateScriptDialogMessage(`读取上传脚本失败：${error?.message ?? String(error)}`, 'error')
  }
}

function addScriptDialogEntryFromSource({ name, script, successLabel }) {
  if (activeScriptLocked.value) {
    updateScriptDialogMessage('请先解锁脚本，再导入脚本。', 'error')
    return false
  }

  const object = findObjectByUuid(scriptDialog.value.nodeUuid)
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error')
    return false
  }

  const source = String(script ?? '').trimEnd()
  if (!source.trim()) {
    updateScriptDialogMessage('脚本内容为空，不能导入。', 'error')
    return false
  }

  syncScriptDialogActiveEntry()

  const entry = createControlScriptEntry({
    name,
    script: source,
  })
  const scripts = [...scriptDialog.value.scripts, entry]
  scriptDialog.value = {
    ...scriptDialog.value,
    scripts,
    activeScriptId: entry.id,
    script: entry.script,
    scriptName: entry.name,
  }
  updateScriptDialogMessage(`已导入${successLabel}，检查后可以保存或执行。`, 'success')
  status.value = scriptDialog.value.message
  return true
}

function unlockActiveScript() {
  const object = findObjectByUuid(scriptDialog.value.nodeUuid)
  const row = nodeRows.value.find((node) => node.uuid === scriptDialog.value.nodeUuid)
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error')
    return
  }

  const wasLookAt = activeScriptIsLookAt.value
  const result =
    wasLookAt && currentModel ? restoreLookAtMeshHierarchy(currentModel, object) : { moved: 0 }

  setScriptDialogActiveEntryLocked(false)
  setBoundNodeControlScripts(object, scriptDialog.value.scripts)
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  updateScriptDialogMessage(
    wasLookAt
      ? `已解锁 lookAt，并恢复 ${result.moved} 个 mesh 的同级关系。`
      : `已解锁脚本：${object.name || row?.displayName || '(未命名)'}`,
    'success'
  )
  status.value = scriptDialog.value.message
  saveCurrentSessionState()
}

function closeScriptDialog() {
  stopScriptDialogDrag()
  stopScriptDialogResize()
  scriptDialog.value = {
    ...scriptDialog.value,
    open: false,
    minimized: false,
    maximized: false,
  }
}

function minimizeScriptDialog() {
  scriptDialog.value = {
    ...scriptDialog.value,
    minimized: true,
    maximized: false,
  }
}

function restoreScriptDialogFromBadge() {
  scriptDialog.value = {
    ...scriptDialog.value,
    minimized: false,
  }
  scriptDialogLayout.value = clampScriptDialogLayout(scriptDialogLayout.value)
}

function toggleScriptDialogTransparency() {
  scriptDialog.value = {
    ...scriptDialog.value,
    transparent: !scriptDialog.value.transparent,
  }
}

function toggleScriptDialogMaximized() {
  if (scriptDialog.value.maximized) {
    scriptDialog.value = {
      ...scriptDialog.value,
      maximized: false,
    }
    scriptDialogLayout.value = clampScriptDialogLayout(scriptDialogLayout.value)
    return
  }

  scriptDialogMaximizedLayout.value = createMaximizedScriptDialogLayout()
  scriptDialog.value = {
    ...scriptDialog.value,
    minimized: false,
    maximized: true,
  }
}

function startScriptDialogDrag(event) {
  if (event.button !== 0 || scriptDialog.value.maximized) return

  event.preventDefault()
  scriptDialogDrag.value = startDialogDrag({
    pointerX: event.clientX,
    pointerY: event.clientY,
    dialogX: scriptDialogLayout.value.x,
    dialogY: scriptDialogLayout.value.y,
  })
  window.addEventListener('pointermove', handleScriptDialogDragMove)
  window.addEventListener('pointerup', stopScriptDialogDrag)
}

function handleScriptDialogDragMove(event) {
  const layout = scriptDialog.value.maximized
    ? scriptDialogMaximizedLayout.value
    : scriptDialogLayout.value
  const position = moveDialogByPointer(scriptDialogDrag.value, {
    pointerX: event.clientX,
    pointerY: event.clientY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    dialogWidth: layout.width,
    dialogHeight: layout.height,
  })
  if (!position) return

  scriptDialogLayout.value = clampScriptDialogLayout({
    ...scriptDialogLayout.value,
    ...position,
  })
}

function stopScriptDialogDrag() {
  scriptDialogDrag.value = stopDialogDrag()
  window.removeEventListener('pointermove', handleScriptDialogDragMove)
  window.removeEventListener('pointerup', stopScriptDialogDrag)
}

function startScriptDialogResize(event, handle) {
  if (event.button !== 0 || scriptDialog.value.maximized) return

  event.preventDefault()
  scriptDialogResize.value = startDialogResize({
    handle,
    pointerX: event.clientX,
    pointerY: event.clientY,
    layout: scriptDialogLayout.value,
  })
  window.addEventListener('pointermove', handleScriptDialogResizeMove)
  window.addEventListener('pointerup', stopScriptDialogResize)
}

function handleScriptDialogResizeMove(event) {
  const nextLayout = resizeDialogByPointer(scriptDialogResize.value, {
    pointerX: event.clientX,
    pointerY: event.clientY,
    bounds: getViewportBounds(),
    minWidth: getScriptDialogMinWidth(),
    minHeight: 360,
    maxWidth: window.innerWidth - 32,
    maxHeight: window.innerHeight - 32,
  })
  if (!nextLayout) return

  scriptDialogLayout.value = nextLayout
}

function stopScriptDialogResize() {
  scriptDialogResize.value = stopDialogResize()
  window.removeEventListener('pointermove', handleScriptDialogResizeMove)
  window.removeEventListener('pointerup', stopScriptDialogResize)
}

function clampScriptDialogLayout(layout) {
  return clampDialogLayout({
    ...layout,
    bounds: getViewportBounds(),
    minWidth: getScriptDialogMinWidth(),
    minHeight: 360,
    maxWidth: window.innerWidth - 32,
    maxHeight: window.innerHeight - 32,
  })
}

function createMaximizedScriptDialogLayout() {
  const bounds = getViewerPanelBounds()
  return {
    x: bounds.x + 12,
    y: bounds.y + 12,
    width: Math.max(320, bounds.width - 24),
    height: Math.max(360, bounds.height - 24),
  }
}

function getScriptDialogMinWidth() {
  return Math.min(480, Math.max(320, window.innerWidth - 32))
}

function getViewerPanelBounds() {
  const rect = viewerPanelRef.value?.getBoundingClientRect?.()
  if (!rect) return getViewportBounds()

  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

function getViewportBounds() {
  return {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function createDefaultScriptDialogLayout() {
  return {
    x: 72,
    y: 72,
    width: 760,
    height: 560,
  }
}

function createInitialScriptDialogLayout() {
  const bounds = getViewerPanelBounds()
  const width = Math.min(760, Math.max(getScriptDialogMinWidth(), bounds.width - 32))
  const height = Math.min(760, Math.max(360, bounds.height - 32))
  return clampScriptDialogLayout({
    x: bounds.x + bounds.width - width - 16,
    y: bounds.y + 16,
    width,
    height,
  })
}

function insertScriptSnippet(snippet) {
  insertScriptText(createScriptSnippetInsertion(scriptDialog.value.script, snippet.code))
}

function insertScriptText(text) {
  if (scriptEditorRef.value?.insertText(text)) return

  scriptDialog.value = {
    ...scriptDialog.value,
    script: `${scriptDialog.value.script}${text}`,
  }
}

function executeDialogScript() {
  stopMotionPlayback()
  const object = findObjectByUuid(scriptDialog.value.nodeUuid)
  const row = nodeRows.value.find((node) => node.uuid === scriptDialog.value.nodeUuid)
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error')
    return false
  }

  syncScriptDialogActiveEntry()

  pushModelHistory()
  const result = runNodeControlScript(object, scriptDialog.value.script, { scene })
  if (!result.ok) {
    undoStack.value = undoStack.value.slice(0, -1)
    updateScriptDialogMessage(`脚本执行失败：${result.error}`, 'error')
    return false
  }

  const isLookAt = activeScriptIsLookAt.value
  const lookAtResult =
    isLookAt && currentModel ? applyLookAtMeshHierarchy(currentModel, object) : { moved: 0 }
  if (isLookAt) {
    setScriptDialogActiveEntryLocked(true)
  }
  setBoundNodeControlScripts(object, scriptDialog.value.scripts)
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  updateScriptDialogMessage(
    isLookAt
      ? `lookAt 已执行并锁定，已把 ${lookAtResult.moved} 个 mesh 挂到对应 _pos 下。`
      : `脚本已执行并保存到节点：${object.name || row?.displayName || '(未命名)'}`,
    'success'
  )
  status.value = scriptDialog.value.message
  saveCurrentSessionState()
  return true
}

function saveDialogScript() {
  if (activeScriptLocked.value) {
    updateScriptDialogMessage('请先解锁脚本，再保存内容。', 'error')
    return
  }

  const object = findObjectByUuid(scriptDialog.value.nodeUuid)
  const row = nodeRows.value.find((node) => node.uuid === scriptDialog.value.nodeUuid)
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error')
    return
  }
  syncScriptDialogActiveEntry()
  if (!scriptDialog.value.script.trim()) {
    updateScriptDialogMessage('请先输入要保存的脚本。', 'error')
    return
  }

  const result = setBoundNodeControlScripts(object, scriptDialog.value.scripts)
  if (!result.ok) {
    updateScriptDialogMessage(`脚本保存失败：${result.error}`, 'error')
    return
  }

  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  updateScriptDialogMessage(
    `已保存 ${scriptDialog.value.scripts.length} 个脚本到节点：${object.name || row?.displayName || '(未命名)'}`,
    'success'
  )
  status.value = scriptDialog.value.message
  saveCurrentSessionState()
}

function clearDialogScript() {
  if (activeScriptLocked.value) {
    updateScriptDialogMessage('请先解锁脚本，再清除绑定。', 'error')
    return
  }

  const object = findObjectByUuid(scriptDialog.value.nodeUuid)
  const row = nodeRows.value.find((node) => node.uuid === scriptDialog.value.nodeUuid)
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error')
    return
  }

  const result = clearNodeControlScript(object)
  if (!result.ok) {
    updateScriptDialogMessage(`清除绑定失败：${result.error}`, 'error')
    return
  }

  const nextState = row
    ? createScriptDialogStateForObject(object, row)
    : createNodeScriptDialogState({
        nodeUuid: object.uuid,
        node: object,
        row: {
          displayName: object.name || '(未命名)',
          type: object.type || 'Object3D',
          path: object.name || '(未命名)',
        },
        transform: cloneTransform(readNodeTransform(object)),
      })
  scriptDialog.value = {
    ...scriptDialog.value,
    ...nextState,
    minimized: scriptDialog.value.minimized,
    transparent: scriptDialog.value.transparent,
    maximized: scriptDialog.value.maximized,
  }
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  updateScriptDialogMessage(
    `已清除节点全部脚本：${object.name || row?.displayName || '(未命名)'}`,
    'success'
  )
  status.value = scriptDialog.value.message
  saveCurrentSessionState()
}

function resetScriptCanvasHelpers() {
  if (typeof window !== 'undefined') {
    const motionStore = window.__tailBeamMotionStore
    if (motionStore?.frameId) {
      window.cancelAnimationFrame(motionStore.frameId)
    }
    window.__tailBeamMotionStore = { frameId: 0 }
  }

  const removed = removeScriptDebugHelpers(scene)
  let resetCount = 0

  if (currentModel) {
    pushModelHistory()
    resetCount = restoreCurrentModelInitialState().restored
    motionProgress.value = 0
    isMotionPlaying.value = false
    motionMessage.value = '已重置模型动作。'
    refreshStructureAfterTransform()
    syncTransformDraftFromSelection()
    saveCurrentSessionState()
  }

  updateScriptDialogMessage(
    `已重置画布：恢复 ${resetCount} 个模型节点，清除 ${removed} 个脚本辅助对象。`,
    'success'
  )
  status.value = scriptDialog.value.message
}

function hideScriptTriangleHelpers() {
  const removed = removeScriptDebugHelpers(scene)
  updateScriptDialogMessage(
    removed > 0 ? `已隐藏 ${removed} 个三角形辅助对象。` : '当前没有显示的三角形辅助对象。',
    'success'
  )
  status.value = scriptDialog.value.message
}

function updateScriptDialogMessage(message, messageType) {
  scriptDialog.value = {
    ...scriptDialog.value,
    message,
    messageType,
  }
}

async function handlePoseFileChange(event, role) {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const payload = JSON.parse(await file.text())
    const result = normalizePosePayload(payload)
    if (!result.ok) {
      motionMessage.value = result.error
      status.value = result.error
      return
    }

    if (role === 'start') {
      startPose.value = result.pose
      motionProgress.value = 0
    } else {
      endPose.value = result.pose
      motionProgress.value = 1
    }

    motionMessage.value = `${role === 'start' ? '起始' : '结束'}姿态已导入：${file.name}，${result.pose.nodeCount} 个节点`
    status.value = motionMessage.value
  } catch (error) {
    motionMessage.value = `姿态文件读取失败：${error.message}`
    status.value = motionMessage.value
  } finally {
    event.target.value = ''
  }
}

function applyImportedPose(role) {
  const pose = role === 'start' ? startPose.value : endPose.value
  if (!currentModel || !pose) {
    motionMessage.value = `请先导入${role === 'start' ? '起始' : '结束'}姿态。`
    return
  }

  stopMotionPlayback()
  const result = applyPoseToModel(currentModel, pose)
  refreshStructureAfterTransform()
  syncTransformDraftFromSelection()
  motionProgress.value = role === 'start' ? 0 : 1
  motionMessage.value = `已应用${role === 'start' ? '起始' : '结束'}姿态：${result.applied} 个节点`
  status.value = motionMessage.value
  saveCurrentSessionState()
}

function toggleMotionPlayback() {
  if (!currentModel) {
    motionMessage.value = '请先加载模型。'
    return
  }

  isMotionPlaying.value = !isMotionPlaying.value
  motionStartedAt = performance.now() - motionProgress.value * 2600
  motionMessage.value = isMotionPlaying.value
    ? '正在播放动作草案。'
    : '动作播放已停止，可以继续拖动进度。'
}

function stopMotionPlayback() {
  isMotionPlaying.value = false
}

function updateMotionPlayback() {
  if (!isMotionPlaying.value || !currentModel) return

  const elapsed = (performance.now() - motionStartedAt) / 2600
  const phase = elapsed % 2
  const progress = phase <= 1 ? phase : 2 - phase
  applyMotionProgress(progress, { silent: true, lightRefresh: true })
}

function handleMotionProgressInput() {
  stopMotionPlayback()
  applyMotionProgress(motionProgress.value)
  scheduleCurrentSessionStateSave()
}

function resetMotionPose() {
  stopMotionPlayback()
  applyMotionProgress(0)
  motionMessage.value = canUsePoseMotion.value
    ? '动作已回到导入的起始姿态。'
    : '动作已回到初始姿态。'
  status.value = motionMessage.value
  saveCurrentSessionState()
}

function applyMotionProgress(progress, { silent = false, lightRefresh = false } = {}) {
  if (!currentModel) {
    motionMessage.value = '请先加载模型。'
    return
  }

  const nextProgress = clampMotionProgress(Number(progress))
  motionProgress.value = Math.round(nextProgress * 1000) / 1000
  isApplyingMotion = true
  let result
  try {
    result = canUsePoseMotion.value
      ? applyPoseTransition(currentModel, startPose.value, endPose.value, nextProgress)
      : applyMechanismMotion(currentModel, originalNodeTransforms, nextProgress)

    if (lightRefresh) {
      currentModel.updateWorldMatrix(true, true)
      selectionBox?.update?.()
      syncTransformDraftFromSelection()
    } else {
      refreshStructureAfterTransform()
      syncTransformDraftFromSelection()
    }
  } finally {
    isApplyingMotion = false
  }

  if (!silent) {
    const appliedCount = Array.isArray(result.applied) ? result.applied.length : result.applied
    motionMessage.value = canUsePoseMotion.value
      ? `已应用姿态动作：${Math.round(nextProgress * 100)}%，匹配 ${appliedCount} 个节点。`
      : `已应用动作进度：${Math.round(nextProgress * 100)}%，驱动 ${appliedCount} 个机构总成。`
    status.value = motionMessage.value
  }
}

function refreshStructureAfterTransform() {
  if (!currentModel) return

  currentModel.updateWorldMatrix(true, true)
  modelInfo.value = collectModelInfo(currentModel, currentGltfMeta, currentFileMeta)
  nodeRows.value = collectRoleNodeRows(currentModel)
  pruneCollapsedNodeUuids()
  pruneHiddenNodeUuids()
  applyModelAppearance()
  updateSelectionBox()
}

function updateTransformControls() {
  if (!transformControls || !transformControlsHelper) return

  const object = findObjectByUuid(selectedNodeUuid.value)
  if (!showTransformGizmo.value || !object) {
    transformControls.detach()
    transformControlsHelper.visible = false
    return
  }

  transformControls.setMode(transformControlMode.value)
  transformControls.setSpace('local')
  transformControls.attach(object)
  transformControlsHelper.visible = true
}

function handleTransformControlDragging(event) {
  if (controls) controls.enabled = !event.value
  if (event.value) {
    didTransformControlChange = false
    return
  }

  if (didTransformControlChange) {
    didTransformControlChange = false
    cancelScheduledSessionSave()
    saveCurrentSessionState()
  }
}

function handleTransformControlMouseDown() {
  if (!findObjectByUuid(selectedNodeUuid.value)) return
  pushModelHistory()
}

function handleTransformControlObjectChange() {
  const object = findObjectByUuid(selectedNodeUuid.value)
  if (!object) return

  transformDraft.value = cloneTransform(readNodeTransform(object))
  refreshStructureAfterTransform()
  didTransformControlChange = true
  scheduleCurrentSessionStateSave()
}

function toggleWireframe() {
  isWireframe.value = !isWireframe.value
  applyModelAppearance()
  status.value = isWireframe.value ? '已打开线框显示' : '已关闭线框显示'
}

function toggleGrid() {
  showGrid.value = !showGrid.value
  if (grid) grid.visible = showGrid.value
}

function toggleModelVisibility() {
  showModel.value = !showModel.value
  applyModelAppearance()
  status.value = showModel.value ? '模型已显示' : '模型已隐藏'
}

function toggleModelTransparency() {
  isModelTransparent.value = !isModelTransparent.value
  applyModelAppearance()
  status.value = isModelTransparent.value ? '模型已半透明' : '模型已恢复不透明'
}

function toggleCameraMode() {
  if (!camera) return

  const nextMode =
    cameraMode.value === CAMERA_MODES.ORTHOGRAPHIC
      ? CAMERA_MODES.PERSPECTIVE
      : CAMERA_MODES.ORTHOGRAPHIC
  const target = controls?.target?.clone?.() ?? new Vector3()
  const nextCamera = createCameraFromCurrent(nextMode, camera, target, currentCanvasAspect())
  nextCamera.quaternion.copy(camera.quaternion)
  camera = nextCamera
  cameraMode.value = nextMode

  if (controls) {
    controls.object = camera
    controls.target.copy(target)
    controls.update()
  }
  if (transformControls) {
    transformControls.camera = camera
    updateTransformControls()
  }
  resizeRenderer()
  status.value = nextMode === CAMERA_MODES.ORTHOGRAPHIC ? '已切换到正交相机' : '已切换到透视相机'
}

function restoreCurrentSessionState() {
  if (!currentModel) return { restored: 0, created: 0 }

  const state = loadModelSessionState(getBrowserSessionStorage(), currentSessionModelName())
  const result = restoreModelSessionState(currentModel, state)
  if (result.restored <= 0) return result

  hiddenNodeUuids.value = result.hiddenNodeUuids
  selectedNodeUuid.value = result.selectedNodeUuid || selectedNodeUuid.value
  return result
}

function saveCurrentSessionState() {
  cancelScheduledSessionSave()
  if (!currentModel) return false

  const state = captureModelSessionState(currentModel, {
    modelName: currentSessionModelName(),
    selectedNodeUuid: selectedNodeUuid.value,
    hiddenNodeUuids: hiddenNodeUuids.value,
  })
  return saveModelSessionState(getBrowserSessionStorage(), currentSessionModelName(), state)
}

function scheduleCurrentSessionStateSave() {
  if (!currentModel || typeof window === 'undefined') return

  cancelScheduledSessionSave()
  sessionSaveTimer = window.setTimeout(() => {
    sessionSaveTimer = 0
    saveCurrentSessionState()
  }, 150)
}

function cancelScheduledSessionSave() {
  if (!sessionSaveTimer || typeof window === 'undefined') return

  window.clearTimeout(sessionSaveTimer)
  sessionSaveTimer = 0
}

function clearCurrentSessionState() {
  const cleared = clearModelSessionState(getBrowserSessionStorage(), currentSessionModelName())
  status.value = cleared ? '已清除当前模型的会话保存' : '当前环境无法清除会话保存'
}

function currentSessionModelName() {
  return currentFileMeta?.name || 'model.glb'
}

function getBrowserSessionStorage() {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function getBrowserClipboard() {
  if (typeof navigator === 'undefined') return null

  return navigator.clipboard ?? null
}

function resetView() {
  if (currentModel) {
    fitCameraToModel(currentModel)
  } else {
    camera.position.set(8, 6, 8)
    controls.target.set(0, 0, 0)
    updateViewerCameraProjection(camera, {
      width: canvasHost.value?.clientWidth,
      height: canvasHost.value?.clientHeight,
      target: controls.target,
    })
    controls.update()
  }
  status.value = '视角已重置'
}

function handleCanvasPointerDown(event) {
  pickStart = {
    x: event.clientX,
    y: event.clientY,
    button: event.button,
  }
}

function handleCanvasPointerUp(event) {
  if (!currentModel || !raycaster || !pointer || !pickStart) return
  if (pickStart.button !== 0 || event.button !== 0) return

  const moveDistance = Math.hypot(event.clientX - pickStart.x, event.clientY - pickStart.y)
  pickStart = null
  if (moveDistance > 4) return

  const hitObject = pickModelObject(event)
  if (!hitObject) return

  const uuid = findSelectableNodeUuid(hitObject, nodeRows.value, hiddenNodeUuids.value)
  if (!uuid) return

  selectNode(uuid, { scrollIntoView: true })
  const object = findObjectByUuid(uuid)
  status.value = `已从模型选中：${object?.name || hitObject.name || '(未命名)'}`
}

function pickModelObject(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  const hits = raycaster.intersectObject(currentModel, true)
  return hits.find((hit) => hit.object?.isMesh)?.object ?? null
}

function fitCameraToModel(model) {
  const box = new Box3().setFromObject(model)
  if (box.isEmpty()) return

  lastBox = box
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  const maxSize = Math.max(size.x, size.y, size.z) || 1
  const distance = maxSize * 2.1

  camera.near = Math.max(distance / 200, 0.01)
  camera.far = distance * 100
  camera.position.set(center.x + distance, center.y + distance * 0.65, center.z + distance)
  camera.lookAt(center)
  if (camera.isOrthographicCamera) {
    camera.userData.viewHeight = maxSize * 2.6
  }
  updateViewerCameraProjection(camera, {
    width: canvasHost.value?.clientWidth,
    height: canvasHost.value?.clientHeight,
    target: center,
  })

  controls.target.copy(center)
  controls.update()

  if (grid) {
    grid.scale.setScalar(Math.max(maxSize / 5, 1))
    grid.position.y = box.min.y - maxSize * 0.02
  }
}

function prepareMaterialStates(model) {
  materialStates = new Map()
  model.traverse((object) => {
    if (!object.isMesh) return
    materialList(object.material).forEach((material) => {
      if (materialStates.has(material)) return
      materialStates.set(material, {
        wireframe: Boolean(material.wireframe),
        transparent: Boolean(material.transparent),
        opacity: material.opacity ?? 1,
        depthWrite: material.depthWrite ?? true,
      })
    })
  })
}

function applyModelAppearance() {
  if (!currentModel) return

  const searchVisibleUuids = isSearchModelOnly.value
    ? collectSearchVisibleNodeUuids(nodeRows.value, nodeKeyword.value)
    : null

  currentModel.traverse((object) => {
    if (!object.isMesh) return

    object.visible =
      showModel.value &&
      !isNodeEffectivelyHidden(object, hiddenNodeUuids.value, currentModel) &&
      (!searchVisibleUuids || searchVisibleUuids.has(object.uuid))
    materialList(object.material).forEach((material) => {
      const original = materialStates.get(material)
      material.wireframe = isWireframe.value || original?.wireframe || false
      material.transparent = isModelTransparent.value || original?.transparent || false
      material.opacity = isModelTransparent.value ? 0.28 : (original?.opacity ?? 1)
      material.depthWrite = isModelTransparent.value ? false : (original?.depthWrite ?? true)
      material.needsUpdate = true
    })
  })
}

function updateSelectionBox() {
  if (selectionBox) {
    scene.remove(selectionBox)
    selectionBox.geometry?.dispose?.()
    selectionBox.material?.dispose?.()
    selectionBox = null
  }

  const object = findObjectByUuid(selectedNodeUuid.value)
  if (!object) {
    updateTransformControls()
    return
  }

  selectionBox = new BoxHelper(object, '#facc15')
  selectionBox.name = '选中节点包围框'
  scene.add(selectionBox)
  updateTransformControls()
  status.value = `已选中节点：${object.name || '(未命名)'}`
}

function findObjectByUuid(uuid) {
  if (!currentModel || !uuid) return null

  let found = null
  currentModel.traverse((object) => {
    if (object.uuid === uuid) found = object
  })
  return found
}

function collectRoleNodeRows(model) {
  const scriptCounts = collectNodeScriptCounts(model)
  return enrichNodeRowsWithRoles(collectNodeRows(model)).map((row) => ({
    ...row,
    scriptCount: scriptCounts.get(row.uuid) ?? 0,
  }))
}

function collectNodeScriptCounts(model) {
  const counts = new Map()
  model?.traverse?.((object) => {
    counts.set(object.uuid, getBoundNodeControlScripts(object).length)
  })
  return counts
}

function pruneCollapsedNodeUuids() {
  if (!collapsedNodeUuids.value.size) return

  const existingUuids = new Set(nodeRows.value.map((node) => node.uuid))
  collapsedNodeUuids.value = new Set(
    [...collapsedNodeUuids.value].filter((uuid) => existingUuids.has(uuid))
  )
}

function pruneHiddenNodeUuids() {
  if (!hiddenNodeUuids.value.size) return

  const existingUuids = new Set(nodeRows.value.map((node) => node.uuid))
  hiddenNodeUuids.value = new Set(
    [...hiddenNodeUuids.value].filter((uuid) => existingUuids.has(uuid))
  )
}

function disposeCurrentModel() {
  cancelScheduledSessionSave()
  if (selectionBox) {
    scene.remove(selectionBox)
    selectionBox.geometry?.dispose?.()
    selectionBox.material?.dispose?.()
    selectionBox = null
  }
  transformControls?.detach()
  if (transformControlsHelper) transformControlsHelper.visible = false

  if (!currentModel) return

  scene.remove(currentModel)
  currentModel.traverse((object) => {
    object.geometry?.dispose?.()
    materialList(object.material).forEach((material) => material.dispose?.())
  })

  currentModel = null
  currentGltfMeta = { animations: [] }
  currentFileMeta = { name: 'model.glb', size: 0 }
  originalNodeTransforms = new Map()
  originalModelEditState = null
  motionProgress.value = 0
  isMotionPlaying.value = false
  startPose.value = null
  endPose.value = null
  motionMessage.value = '动作演示会按节点名称驱动，不使用手动标点。'
  lastBox = null
  materialStates = new Map()
  modelReady.value = false
  modelInfo.value = null
  nodeRows.value = []
  collapsedNodeUuids.value = new Set()
  hiddenNodeUuids.value = new Set()
  isSearchModelOnly.value = false
  undoStack.value = []
  selectedNodeUuid.value = ''
  nodeKeyword.value = ''
  transformDraft.value = createEmptyTransform()
  scriptDialog.value = createClosedScriptDialog()
  infoDialog.value = createClosedInfoDialog()
}

function materialList(material) {
  if (!material) return []
  return Array.isArray(material) ? material.filter(Boolean) : [material]
}

function createClosedScriptDialog() {
  return {
    open: false,
    nodeUuid: '',
    nodeTitle: '',
    nodeType: '',
    nodePath: '',
    scripts: [],
    activeScriptId: '',
    script: '',
    scriptName: '',
    message: '',
    messageType: 'hint',
    minimized: false,
    transparent: true,
    maximized: false,
  }
}

function createClosedInfoDialog() {
  return {
    open: false,
    nodeUuid: '',
    collapsed: new Set(),
  }
}

function createEmptyTransform() {
  return {
    position: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    scale: [1, 1, 1],
  }
}
</script>

<template>
  <main class="app-shell" :style="appShellStyle" @click="closeContextMenu">
    <aside class="structure-panel">
      <section class="info-section node-section">
        <div class="section-title-row">
          <h2>节点列表</h2>
          <div class="node-title-actions">
            <button type="button" :disabled="!modelReady" @click="refreshStructure">刷新</button>
            <button
              type="button"
              :disabled="!modelReady || collapsibleNodeRows.length === 0"
              @click="toggleAllNodeCollapse"
            >
              {{ hasExpandedCollapsibleNodes ? '全部收起' : '全部展开' }}
            </button>
            <button type="button" :disabled="!modelReady" @click="toggleAllNodesVisibility">
              {{ allNodesHidden ? '全部展示' : '全部隐藏' }}
            </button>
          </div>
        </div>
        <div class="node-tools">
          <input v-model="nodeKeyword" type="text" placeholder="按名称、类型、父节点或路径筛选" />
          <button
            type="button"
            class="search-model-toggle"
            :class="{ active: isSearchModelOnly }"
            :disabled="!modelReady || !hasNodeKeyword"
            :aria-pressed="isSearchModelOnly"
            @click="toggleSearchModelOnly"
          >
            {{ isSearchModelOnly ? '显示全部' : '只看匹配' }}
          </button>
        </div>
        <p class="empty-text">
          共 {{ nodeRows.length }} 个节点，当前匹配 {{ filteredNodeRows.length }} 个，列表展示
          {{ nodePreviewRows.length }} 条。
        </p>

        <ul ref="nodeListRef" v-if="nodePreviewRows.length" class="node-list">
          <li
            v-for="node in nodePreviewRows"
            :key="node.uuid"
            :style="{ '--node-depth': node.depth }"
            :class="{
              active: node.uuid === selectedNodeUuid,
              dragging: node.uuid === draggedNodeUuid,
              'drop-target': node.uuid === dragOverNodeUuid,
              'drop-before': isNodeDropPlacement(node, NODE_DROP_PLACEMENTS.BEFORE),
              'drop-inside': isNodeDropPlacement(node, NODE_DROP_PLACEMENTS.INSIDE),
              'drop-after': isNodeDropPlacement(node, NODE_DROP_PLACEMENTS.AFTER),
              'can-drop': canDropOnNode(node),
              'hidden-node': isNodeHidden(node),
            }"
            :draggable="canDragNode(node)"
            @contextmenu.prevent.stop="handleNodeContextMenu($event, node)"
            @dragstart="handleNodeDragStart($event, node.uuid)"
            @dragover="handleNodeDragOver($event, node)"
            @dragleave="handleNodeDragLeave(node)"
            @drop="handleNodeDrop($event, node.uuid)"
            @dragend="handleNodeDragEnd"
          >
            <button
              type="button"
              class="collapse-toggle"
              :class="{ hidden: !canCollapseNode(node) }"
              :aria-label="isNodeCollapsed(node.uuid) ? '展开 Object3D' : '折叠 Object3D'"
              :aria-expanded="canCollapseNode(node) ? !isNodeCollapsed(node.uuid) : undefined"
              @click.stop="toggleNodeCollapse(node)"
            >
              {{ isNodeCollapsed(node.uuid) ? '▶' : '▼' }}
            </button>
            <span class="node-type-icon" :title="node.type" aria-hidden="true">
              <svg v-if="node.type === 'Mesh'" viewBox="0 0 24 24">
                <path d="M12 3 4.5 7.2 12 11.4l7.5-4.2L12 3Z" />
                <path d="M4.5 7.2v8.4L12 20l7.5-4.4V7.2" />
                <path d="M12 11.4V20" />
              </svg>
              <svg v-else-if="node.type === 'Group'" viewBox="0 0 24 24">
                <path
                  d="M3.5 6.5h6l2 2h9v9.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V6.5Z"
                />
                <path d="M3.5 6.5V5.2c0-.7.6-1.2 1.3-1.2h4.5l2 2" />
              </svg>
              <svg v-else-if="node.type === 'Bone'" viewBox="0 0 24 24">
                <path d="M6.5 8.5a2.4 2.4 0 1 1 3.4-3.4l9 9a2.4 2.4 0 1 1-3.4 3.4l-9-9Z" />
                <path d="M4.7 10.3a2 2 0 1 1 3.1-2.5" />
                <path d="M16.2 16.2a2 2 0 1 1-2.5 3.1" />
              </svg>
              <svg v-else-if="node.type === 'Object3D'" viewBox="0 0 24 24">
                <path
                  d="M3.5 6.5h6l2 2h9v9.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V6.5Z"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6.5" />
              </svg>
            </span>
            <button
              v-if="!canRenameNode(node)"
              type="button"
              class="node-select"
              :title="node.path"
              @click="selectNode(node.uuid)"
            >
              <span class="node-title">
                {{ node.displayName }}
              </span>
              <span class="node-meta">
                <span
                  v-if="node.scriptCount > 0"
                  class="node-script-badge"
                  :title="`${node.scriptCount} 个绑定脚本`"
                  :aria-label="`${node.scriptCount} 个绑定脚本`"
                >
                  {{ node.scriptCount }}
                </span>
                <span>{{ node.type }}</span>
              </span>
            </button>
            <div
              v-else
              class="node-select node-editable"
              :title="node.path"
              @click="selectNode(node.uuid)"
            >
              <input
                class="node-name-input"
                :value="node.displayName"
                aria-label="Object3D 名称"
                @click.stop
                @focus="selectNode(node.uuid)"
                @change="renameNodeFromEvent(node, $event)"
                @keydown.enter="$event.target.blur()"
              />
              <span class="node-meta">
                <span
                  v-if="node.scriptCount > 0"
                  class="node-script-badge"
                  :title="`${node.scriptCount} 个绑定脚本`"
                  :aria-label="`${node.scriptCount} 个绑定脚本`"
                >
                  {{ node.scriptCount }}
                </span>
                <span>{{ node.type }}</span>
              </span>
            </div>
            <button
              type="button"
              class="node-copy-button"
              :aria-label="`复制 ${node.displayName} 的节点名称`"
              title="复制节点名称"
              @click.stop="copyNodeName(node)"
            >
              复制
            </button>
            <button
              type="button"
              class="node-visibility-toggle"
              :disabled="node.uuid === currentModel?.uuid"
              :aria-label="
                isNodeHidden(node) ? `显示 ${node.displayName}` : `隐藏 ${node.displayName}`
              "
              :title="isNodeHidden(node) ? '显示节点' : '隐藏节点'"
              @click.stop="toggleNodeVisibility(node)"
            >
              <svg v-if="isNodeHidden(node)" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path
                  d="M9.9 4.2A9.8 9.8 0 0 1 12 4c5 0 8.5 4.4 9.6 6a2.3 2.3 0 0 1 0 2.1 16.2 16.2 0 0 1-2.1 2.6"
                />
                <path
                  d="M6.5 6.5A16 16 0 0 0 2.4 10a2.3 2.3 0 0 0 0 2.1C3.5 13.7 7 18 12 18a9.7 9.7 0 0 0 4-.8"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M2.4 10a2.3 2.3 0 0 0 0 2.1C3.5 13.7 7 18 12 18s8.5-4.3 9.6-5.9a2.3 2.3 0 0 0 0-2.1C20.5 8.4 17 4 12 4S3.5 8.4 2.4 10Z"
                />
                <circle cx="12" cy="11" r="3" />
              </svg>
            </button>
          </li>
        </ul>
        <p v-else class="empty-text">没有匹配的节点。</p>
      </section>
    </aside>

    <div class="panel-resizer" aria-hidden="true" @pointerdown.prevent="startStructureResize"></div>

    <section ref="viewerPanelRef" class="viewer-panel">
      <div class="canvas-transform-toolbar" aria-label="节点变换工具" @pointerdown.stop @click.stop>
        <div class="toolbar-group" aria-label="变换模式">
          <button
            v-for="mode in TRANSFORM_MODES"
            :key="mode.key"
            type="button"
            :class="{ active: transformControlMode === mode.key }"
            :disabled="!selectedNode"
            :aria-pressed="transformControlMode === mode.key"
            @click="setTransformControlMode(mode.key)"
          >
            {{ mode.label }}
          </button>
        </div>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <div class="toolbar-group" aria-label="显示控制">
          <button
            type="button"
            :class="{ active: isWireframe }"
            :disabled="!modelReady"
            @click="toggleWireframe"
          >
            {{ isWireframe ? '关闭线框' : '线框' }}
          </button>
          <button type="button" :class="{ active: showGrid }" @click="toggleGrid">
            {{ showGrid ? '网格' : '显示网格' }}
          </button>
          <button
            type="button"
            :class="{ active: isModelTransparent }"
            :disabled="!modelReady"
            @click="toggleModelTransparency"
          >
            {{ isModelTransparent ? '关闭透明' : '透明' }}
          </button>
          <button
            type="button"
            :class="{ active: showModel }"
            :disabled="!modelReady"
            @click="toggleModelVisibility"
          >
            {{ showModel ? '隐藏模型' : '显示模型' }}
          </button>
        </div>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <div class="toolbar-group" aria-label="相机">
          <button
            type="button"
            :class="{ active: cameraMode === CAMERA_MODES.ORTHOGRAPHIC }"
            :aria-pressed="cameraMode === CAMERA_MODES.ORTHOGRAPHIC"
            :title="cameraModeButtonLabel"
            @click="toggleCameraMode"
          >
            相机：{{ cameraModeText }}
          </button>
        </div>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <div class="toolbar-group" aria-label="操作">
          <button type="button" :disabled="undoStack.length === 0" @click="undoModelEdit">
            撤销
          </button>
          <button type="button" :disabled="!selectedNode" @click="resetSelectedNodeTransform">
            局部重置
          </button>
          <button type="button" :disabled="!modelReady" @click="resetModelTransform">重置</button>
          <button type="button" :disabled="!modelReady" @click="reloadCurrentModelSource">
            重读模型
          </button>
        </div>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <div class="toolbar-group" aria-label="节点操作">
          <button type="button" :disabled="!modelReady" @click="addPartObject3D">新建</button>
          <button type="button" :disabled="!modelReady" @click="initializeMeshObjects">
            初始化
          </button>
        </div>
      </div>
      <div ref="canvasHost" class="canvas-host" aria-label="GLB 模型预览窗口"></div>
    </section>

    <aside class="side-panel">
      <section class="info-section">
        <h2>文件操作</h2>
        <label class="file-picker">
          <span>选择本地 GLB 文件</span>
          <input type="file" accept=".glb,model/gltf-binary" @change="handleFileChange" />
        </label>
        <div class="status-line" :class="{ loading: isLoading }">{{ status }}</div>
        <div class="button-grid file-actions">
          <button type="button" :disabled="!modelReady" @click="exportEditedModel">导出模型</button>
          <button type="button" @click="clearCurrentSessionState">清除会话</button>
        </div>
      </section>

      <section class="info-section">
        <h2>选中节点变换</h2>
        <div v-if="selectedNode" class="selected-node-panel">
          <p class="selected-node-title">{{ selectedNode.displayName }}</p>
          <div class="transform-readout">
            <div class="transform-readout-head" aria-hidden="true">
              <span></span>
              <span>X</span>
              <span>Y</span>
              <span>Z</span>
            </div>
            <div v-for="row in transformDisplayRows" :key="row.key" class="transform-readout-row">
              <strong>{{ row.label }}</strong>
              <span v-for="(value, index) in row.values" :key="`${row.key}-${index}`">{{
                value
              }}</span>
            </div>
          </div>
          <div class="button-grid selected-node-actions">
            <button type="button" @click="openScriptDialog(selectedNode.uuid)">编辑脚本</button>
            <button type="button" @click="focusNodeByUuid(selectedNode.uuid)">聚焦</button>
          </div>
        </div>
        <p v-else class="empty-text">选中节点后显示位置、角度和缩放。</p>
      </section>

      <section class="info-section">
        <h2>查看控制</h2>
        <div class="button-grid">
          <button type="button" @click="resetView">重置视角</button>
        </div>
      </section>

      <details class="info-section info-details">
        <summary>模型信息</summary>
        <dl v-if="modelInfo" class="info-list">
          <div>
            <dt>文件名</dt>
            <dd>{{ modelInfo.fileName }}</dd>
          </div>
          <div>
            <dt>大小</dt>
            <dd>{{ modelInfo.fileSize }}</dd>
          </div>
          <div>
            <dt>节点</dt>
            <dd>{{ modelInfo.nodeCount }}</dd>
          </div>
          <div>
            <dt>网格</dt>
            <dd>{{ modelInfo.meshCount }}</dd>
          </div>
          <div>
            <dt>材质</dt>
            <dd>{{ modelInfo.materialCount }}</dd>
          </div>
          <div>
            <dt>三角面</dt>
            <dd>{{ modelInfo.triangleCount }}</dd>
          </div>
          <div>
            <dt>内置动画</dt>
            <dd>{{ modelInfo.animationCount }}</dd>
          </div>
          <div>
            <dt>包围盒</dt>
            <dd>{{ modelInfo.size }}</dd>
          </div>
          <div>
            <dt>中心点</dt>
            <dd>{{ modelInfo.center.join(', ') }}</dd>
          </div>
        </dl>
        <p v-else class="empty-text">加载模型后显示文件、网格、材质和包围盒信息。</p>
      </details>
    </aside>

    <section
      v-if="scriptDialog.open && !scriptDialog.minimized"
      class="modal-panel script-modal floating-script-modal"
      :class="{
        transparent: scriptDialog.transparent,
        maximized: scriptDialog.maximized,
      }"
      :style="scriptDialogStyle"
      @click.stop
    >
      <header class="modal-header draggable-modal-header" @pointerdown="startScriptDialogDrag">
        <div>
          <h2>编辑脚本</h2>
          <p>{{ scriptDialog.nodeTitle }} / {{ scriptDialog.nodeType }}</p>
        </div>
        <div class="script-window-actions">
          <button type="button" @pointerdown.stop @click="toggleScriptDialogTransparency">
            {{ scriptDialog.transparent ? '不透明' : '透明' }}
          </button>
          <button
            type="button"
            title="最小化"
            aria-label="最小化脚本窗口"
            @pointerdown.stop
            @click="minimizeScriptDialog"
          >
            —
          </button>
          <button type="button" @pointerdown.stop @click="toggleScriptDialogMaximized">
            {{ scriptDialog.maximized ? '还原' : '最大化' }}
          </button>
          <button
            type="button"
            title="关闭"
            aria-label="关闭脚本窗口"
            @pointerdown.stop
            @click="closeScriptDialog"
          >
            ×
          </button>
        </div>
      </header>
      <p class="modal-path">{{ scriptDialog.nodePath }}</p>
      <div class="script-workspace">
        <aside class="script-list-panel" aria-label="脚本列表">
          <div class="script-list-header">
            <strong>脚本列表</strong>
            <span>{{ scriptDialog.scripts.length }} 个</span>
          </div>
          <div class="script-list">
            <button
              v-for="(scriptItem, index) in scriptDialog.scripts"
              :key="scriptItem.id"
              type="button"
              class="script-list-item"
              :class="{
                active: scriptItem.id === scriptDialog.activeScriptId,
                locked: scriptItem.locked,
              }"
              @click="selectScriptDialogScript(scriptItem.id)"
            >
              <span>{{ scriptItem.name || `脚本 ${index + 1}` }}</span>
              <small
                >{{ createCodeStats(scriptItem.script).lines }} 行{{
                  scriptItem.locked ? ' · 已锁定' : ''
                }}</small
              >
            </button>
          </div>
        </aside>
        <section class="script-editor-panel">
          <div class="script-entry-bar">
            <label class="script-name-field">
              <span>脚本名称</span>
              <input
                v-model="scriptDialog.scriptName"
                type="text"
                autocomplete="off"
                spellcheck="false"
                :disabled="activeScriptLocked"
              />
            </label>
            <div class="script-entry-actions">
              <button type="button" :disabled="activeScriptLocked" @click="createScriptDialogEntry">
                新建脚本
              </button>
              <button
                type="button"
                :disabled="activeScriptLocked || scriptDialog.scripts.length <= 1"
                @click="deleteScriptDialogEntry"
              >
                删除当前
              </button>
              <button v-if="activeScriptLocked" type="button" @click="unlockActiveScript">
                解锁
              </button>
            </div>
          </div>
          <div class="script-source-bar">
            <label class="script-source-field">
              <span>脚本库</span>
              <select
                v-model="selectedScriptLibraryId"
                :disabled="activeScriptLocked || SCRIPT_LIBRARY_ITEMS.length <= 0"
              >
                <option v-if="SCRIPT_LIBRARY_ITEMS.length <= 0" value="">没有内置脚本</option>
                <option v-for="item in SCRIPT_LIBRARY_ITEMS" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </select>
            </label>
            <div class="script-source-actions">
              <button
                type="button"
                :disabled="activeScriptLocked || !selectedScriptLibraryItem"
                @click="importSelectedScriptLibraryItem"
              >
                导入选中
              </button>
              <button type="button" :disabled="activeScriptLocked" @click="openScriptUploadPicker">
                上传 JS
              </button>
              <input
                ref="scriptUploadInputRef"
                class="script-upload-input"
                type="file"
                accept=".js,text/javascript,application/javascript"
                @change="handleScriptUpload"
              />
            </div>
          </div>
          <div class="code-toolbar" aria-label="脚本快捷插入">
            <span>插入</span>
            <button
              v-for="snippet in SCRIPT_SNIPPETS"
              :key="snippet.label"
              type="button"
              @pointerdown.stop
              :disabled="activeScriptLocked"
              @click="insertScriptSnippet(snippet)"
            >
              {{ snippet.label }}
            </button>
            <em>{{ scriptEditorStats.lines }} 行 / {{ scriptEditorStats.chars }} 字符</em>
          </div>
          <div class="code-editor-shell">
            <ScriptCodeEditor
              ref="scriptEditorRef"
              v-model="scriptDialog.script"
              :readOnly="activeScriptLocked"
              aria-label="节点 JS 脚本"
              @run="executeDialogScript"
            />
          </div>
          <p class="code-help">
            可用：node、scene、THREE、setPosition(x,y,z)、setRotationDeg(x,y,z)、setScale(x,y,z)、deg(角度)。按
            Ctrl/Command + Enter 执行。
          </p>
        </section>
      </div>
      <div class="modal-actions">
        <button type="button" @click="executeDialogScript">执行当前</button>
        <button type="button" :disabled="activeScriptLocked" @click="saveDialogScript">
          保存全部
        </button>
        <button type="button" :disabled="activeScriptLocked" @click="clearDialogScript">
          清除绑定
        </button>
        <button type="button" @click="hideScriptTriangleHelpers">隐藏三角形</button>
        <button type="button" @click="resetScriptCanvasHelpers">重置画布</button>
      </div>
      <p class="transform-message" :class="scriptDialogMessageClass">{{ scriptDialog.message }}</p>
      <span
        v-for="handle in SCRIPT_DIALOG_RESIZE_HANDLES"
        :key="handle"
        class="script-resize-handle"
        :class="`handle-${handle}`"
        aria-hidden="true"
        @pointerdown.stop.prevent="startScriptDialogResize($event, handle)"
      ></span>
    </section>

    <button
      v-if="scriptDialog.open && scriptDialog.minimized"
      type="button"
      class="script-dialog-badge"
      :style="scriptDialogBadgeStyle"
      @click.stop="restoreScriptDialogFromBadge"
    >
      <span>{{ scriptDialog.nodeTitle }}</span>
      <strong>编辑脚本</strong>
    </button>

    <div
      v-if="nodeContextMenu.open"
      class="node-context-menu"
      :style="{ left: `${nodeContextMenu.x}px`, top: `${nodeContextMenu.y}px` }"
      @click.stop
    >
      <button
        v-for="item in nodeContextMenuItems"
        :key="item.action"
        type="button"
        @click="handleContextMenuAction(item.action)"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="infoDialog.open" class="modal-backdrop" @click.self="closeInfoDialog">
      <section class="modal-panel info-modal" @click.stop>
        <header class="modal-header">
          <div>
            <h2>节点信息</h2>
            <p>{{ activeInfoNode?.displayName || '(未命名)' }}</p>
          </div>
          <button type="button" @click="closeInfoDialog">关闭</button>
        </header>
        <div class="info-section-list">
          <section
            v-for="section in activeInfoSections"
            :key="section.key"
            class="info-fold-section"
          >
            <button type="button" class="info-fold-title" @click="toggleInfoSection(section.key)">
              <span>{{ section.title }}</span>
              <span>{{ isInfoSectionCollapsed(section.key) ? '展开' : '收起' }}</span>
            </button>
            <dl v-if="!isInfoSectionCollapsed(section.key)" class="info-list detail-list">
              <div v-for="item in section.items" :key="`${section.key}-${item.label}`">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>
