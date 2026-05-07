<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  AmbientLight,
  Box3,
  BoxHelper,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  LinearToneMapping,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import defaultModelUrl from './F309.glb?url';
import {
  collectModelInfo,
  collectNodeRows,
  createPoseExport,
  createStructureExport,
} from './modelStructure.js';
import { createEditedGlbFileName, exportModelAsGlb } from './modelExport.js';
import {
  captureOriginalNodeTransforms,
  cloneTransform,
  readNodeTransform,
  resetAllNodeTransforms,
  resetNodeTransform,
} from './modelTransform.js';
import {
  captureModelEditState,
  restoreModelEditState,
} from './modelHistory.js';
import {
  captureModelSessionState,
  clearModelSessionState,
  ensureModelSessionNodeKeys,
  loadModelSessionState,
  restoreModelSessionState,
  saveModelSessionState,
} from './modelSessionState.js';
import {
  applyMechanismMotion,
  clampMotionProgress,
} from './mechanismMotion.js';
import {
  applyPoseToModel,
  applyPoseTransition,
  normalizePosePayload,
} from './poseMotion.js';
import { findSelectableNodeUuid } from './modelSelection.js';
import {
  createPartObject3D,
  createSiblingPartObject3D,
  deleteCreatedObject3D,
  isViewerCreatedObject3D,
  moveNodeNextToObject3D,
  moveNodeToObject3D,
  renameCreatedObject3D,
} from './modelGrouping.js';
import { filterCollapsedNodeRows } from './nodeCollapse.js';
import {
  collectSearchVisibleNodeUuids,
  filterNodeRowsByKeyword,
} from './nodeSearch.js';
import {
  DEFAULT_TRANSFORM_MODE,
  TRANSFORM_MODES,
  normalizeTransformMode,
} from './transformModes.js';
import {
  closeNodeContextMenu,
  createClosedNodeContextMenu,
  getNodeContextMenuItems,
  openNodeContextMenu,
} from './nodeContextMenu.js';
import {
  clampDialogPosition,
  createDialogDragState,
  moveDialogByPointer,
  startDialogDrag,
  stopDialogDrag,
} from './dialogDrag.js';
import { canDropNodeOnTarget } from './nodeDropRules.js';
import { createNodeFocusTarget, applyNodeFocusTarget } from './nodeFocus.js';
import { createNodeInfoSections } from './nodeInfoSections.js';
import { createAllHiddenNodeSet, isNodeEffectivelyHidden, toggleHiddenNode } from './nodeVisibility.js';
import { clampPanelWidth } from './panelResize.js';
import {
  bindNodeControlScript,
  clearNodeControlScript,
  getBoundNodeControlScript,
  hasBoundNodeControlScript,
  runNodeControlScript,
} from './nodeScriptControl.js';
import {
  CONNECTION_DRAFT,
  MECHANISM_ROLES,
  enrichNodeRowsWithRoles,
} from './mechanismRoles.js';
import { getNodeDropPlacement, NODE_DROP_PLACEMENTS } from './nodeDropPlacement.js';
import { copyNodeNameToClipboard } from './nodeClipboard.js';
import {
  createCodeLineNumbers,
  createCodeStats,
  insertTextAtSelection,
  isRunShortcut,
} from './codeEditor.js';
import { removeScriptDebugHelpers } from './scriptDebugHelpers.js';

const NODE_PREVIEW_LIMIT = 180;
const MAX_UNDO_STEPS = 40;
const SCRIPT_SNIPPETS = [
  { label: '位置', code: 'setPosition(0, 0, 0);' },
  { label: '旋转', code: 'setRotationDeg(0, 0, 0);' },
  { label: '缩放', code: 'setScale(1, 1, 1);' },
  { label: '角度', code: 'node.rotation.y = deg(15);' },
];
const canvasHost = ref(null);
const scriptEditorRef = ref(null);
const status = ref('正在加载默认模型 F309.glb');
const isLoading = ref(false);
const modelReady = ref(false);
const modelInfo = ref(null);
const nodeRows = ref([]);
const nodeKeyword = ref('');
const selectedNodeUuid = ref('');
const transformDraft = ref(createEmptyTransform());
const showTransformGizmo = ref(true);
const transformControlMode = ref(DEFAULT_TRANSFORM_MODE);
const motionProgress = ref(0);
const isMotionPlaying = ref(false);
const motionMessage = ref('动作演示会按节点名称驱动，不使用手动标点。');
const startPose = ref(null);
const endPose = ref(null);
const isWireframe = ref(false);
const showGrid = ref(true);
const showModel = ref(true);
const isModelTransparent = ref(false);
const draggedNodeUuid = ref('');
const dragOverNodeUuid = ref('');
const dragOverPlacement = ref('');
const collapsedNodeUuids = ref(new Set());
const hiddenNodeUuids = ref(new Set());
const isSearchModelOnly = ref(false);
const undoStack = ref([]);
const structurePanelWidth = ref(320);
const nodeContextMenu = ref(createClosedNodeContextMenu());
const scriptDialog = ref(createClosedScriptDialog());
const scriptDialogDrag = ref(createDialogDragState());
const scriptEditorScrollTop = ref(0);
const infoDialog = ref(createClosedInfoDialog());

let scene;
let camera;
let renderer;
let controls;
let transformControls;
let transformControlsHelper;
let raycaster;
let pointer;
let pickStart = null;
let grid;
let loader;
let resizeObserver;
let frameId = 0;
let currentModel = null;
let currentGltfMeta = { animations: [] };
let currentFileMeta = { name: 'model.glb', size: 0 };
let originalNodeTransforms = new Map();
let motionStartedAt = 0;
let isApplyingMotion = false;
let lastBox = null;
let selectionBox = null;
let materialStates = new Map();
let isResizingStructurePanel = false;
let isUndoingModelEdit = false;
let sessionSaveTimer = 0;
let didTransformControlChange = false;

const visibleNodeRows = computed(() => filterCollapsedNodeRows(nodeRows.value, collapsedNodeUuids.value));
const filteredNodeRows = computed(() => filterNodeRowsByKeyword(visibleNodeRows.value, nodeKeyword.value));
const nodePreviewRows = computed(() => filteredNodeRows.value.slice(0, NODE_PREVIEW_LIMIT));
const hasNodeKeyword = computed(() => Boolean(nodeKeyword.value.trim()));
const selectedNode = computed(() => nodeRows.value.find((node) => node.uuid === selectedNodeUuid.value) ?? null);
const roleSummaryRows = computed(() =>
  MECHANISM_ROLES.map((role) => ({
    ...role,
    nodeCount: nodeRows.value.filter((node) => node.mechanismRole?.key === role.key).length,
  })).filter((role) => role.nodeCount > 0),
);
const nodeContextMenuItems = computed(() => getNodeContextMenuItems());
const activeInfoNode = computed(() => nodeRows.value.find((node) => node.uuid === infoDialog.value.nodeUuid) ?? null);
const activeInfoSections = computed(() => createNodeInfoSections(activeInfoNode.value));
const scriptDialogMessageClass = computed(() => ({
  error: scriptDialog.value.messageType === 'error',
  success: scriptDialog.value.messageType === 'success',
}));
const scriptEditorLineNumbers = computed(() => createCodeLineNumbers(scriptDialog.value.script));
const scriptEditorStats = computed(() => createCodeStats(scriptDialog.value.script));
const canUsePoseMotion = computed(() => Boolean(startPose.value && endPose.value));
const appShellStyle = computed(() => ({
  '--structure-panel-width': `${structurePanelWidth.value}px`,
}));

onMounted(() => {
  setupScene();
  resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(canvasHost.value);
  animate();
  loadDefaultModel();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  renderer?.domElement?.removeEventListener('pointerdown', handleCanvasPointerDown);
  renderer?.domElement?.removeEventListener('pointerup', handleCanvasPointerUp);
  window.removeEventListener('pointermove', handleStructureResizeMove);
  window.removeEventListener('pointerup', stopStructureResize);
  window.removeEventListener('pointermove', handleScriptDialogDragMove);
  window.removeEventListener('pointerup', stopScriptDialogDrag);
  cancelScheduledSessionSave();
  transformControls?.dispose();
  controls?.dispose();
  disposeCurrentModel();
  renderer?.dispose();
});

watch(nodeKeyword, (keyword) => {
  if (!keyword.trim() && isSearchModelOnly.value) {
    isSearchModelOnly.value = false;
  }
  if (currentModel) applyModelAppearance();
});

async function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb')) {
    status.value = '请选择 .glb 文件';
    return;
  }

  isLoading.value = true;
  status.value = `正在读取 ${file.name}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    parseGlb(arrayBuffer, file);
  } catch (error) {
    isLoading.value = false;
    status.value = `读取失败：${error.message}`;
  } finally {
    event.target.value = '';
  }
}

async function loadDefaultModel() {
  isLoading.value = true;
  status.value = '正在加载默认模型 F309.glb';

  try {
    const response = await fetch(defaultModelUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    parseGlb(arrayBuffer, {
      name: 'F309.glb',
      size: Number(response.headers.get('content-length')) || arrayBuffer.byteLength,
    });
  } catch (error) {
    isLoading.value = false;
    status.value = `默认模型加载失败：${error.message}。也可以手动选择 .glb 文件。`;
  }
}

function parseGlb(arrayBuffer, file) {
  loader.parse(
    arrayBuffer,
    '',
    (gltf) => {
      disposeCurrentModel();

      currentModel = gltf.scene;
      currentGltfMeta = gltf;
      currentFileMeta = file;
      scene.add(currentModel);
      prepareMaterialStates(currentModel);
      currentModel.updateWorldMatrix(true, true);
      ensureModelSessionNodeKeys(currentModel);

      modelInfo.value = collectModelInfo(currentModel, currentGltfMeta, currentFileMeta);
      nodeRows.value = collectRoleNodeRows(currentModel);
      originalNodeTransforms = captureOriginalNodeTransforms(currentModel);
      motionProgress.value = 0;
      isMotionPlaying.value = false;
      startPose.value = null;
      endPose.value = null;
      undoStack.value = [];
      motionMessage.value = '动作演示会按节点名称驱动，不使用手动标点。';
      selectedNodeUuid.value = nodeRows.value[0]?.uuid ?? '';
      modelReady.value = nodeRows.value.length > 0;
      pruneCollapsedNodeUuids();
      pruneHiddenNodeUuids();
      const sessionResult = restoreCurrentSessionState();
      if (sessionResult.restored > 0) {
        modelInfo.value = collectModelInfo(currentModel, currentGltfMeta, currentFileMeta);
        nodeRows.value = collectRoleNodeRows(currentModel);
        pruneCollapsedNodeUuids();
        pruneHiddenNodeUuids();
        if (!findObjectByUuid(selectedNodeUuid.value)) {
          selectedNodeUuid.value = nodeRows.value[0]?.uuid ?? '';
        }
      }

      fitCameraToModel(currentModel);
      applyModelAppearance();
      syncTransformDraftFromSelection();
      updateSelectionBox();

      isLoading.value = false;
      status.value = sessionResult.restored > 0
        ? `加载成功：${file.name}，已恢复当前会话保存的模型编辑`
        : `加载成功：${file.name}，共 ${nodeRows.value.length} 个节点`;
    },
    (error) => {
      isLoading.value = false;
      status.value = `模型解析失败：${error.message}`;
    },
  );
}

function setupScene() {
  scene = new Scene();
  scene.background = new Color('#0f172a');

  camera = new PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(8, 6, 8);

  renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = LinearToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasHost.value.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown);
  renderer.domElement.addEventListener('pointerup', handleCanvasPointerUp);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode(transformControlMode.value);
  transformControls.setSize(0.85);
  transformControls.addEventListener('dragging-changed', handleTransformControlDragging);
  transformControls.addEventListener('mouseDown', handleTransformControlMouseDown);
  transformControls.addEventListener('objectChange', handleTransformControlObjectChange);
  transformControlsHelper = transformControls.getHelper();
  transformControlsHelper.visible = false;
  scene.add(transformControlsHelper);

  const ambientLight = new AmbientLight('#fff7ed', 1.6);
  scene.add(ambientLight);

  const hemiLight = new HemisphereLight('#f8fafc', '#475569', 3.2);
  scene.add(hemiLight);

  const keyLight = new DirectionalLight('#ffffff', 3.8);
  keyLight.position.set(6, 8, 5);
  scene.add(keyLight);

  const fillLight = new DirectionalLight('#dbeafe', 2.4);
  fillLight.position.set(-6, 4, 7);
  scene.add(fillLight);

  const rimLight = new DirectionalLight('#fde68a', 1.8);
  rimLight.position.set(3, 10, -6);
  scene.add(rimLight);

  grid = new GridHelper(10, 20, '#475569', '#334155');
  grid.position.y = -0.02;
  scene.add(grid);

  loader = new GLTFLoader();
  raycaster = new Raycaster();
  pointer = new Vector2();
  resizeRenderer();
}

function animate() {
  frameId = requestAnimationFrame(animate);
  updateMotionPlayback();
  controls?.update();
  renderer?.render(scene, camera);
}

function resizeRenderer() {
  if (!renderer || !camera || !canvasHost.value) return;

  const { clientWidth, clientHeight } = canvasHost.value;
  if (clientWidth === 0 || clientHeight === 0) return;

  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function refreshStructure() {
  if (!currentModel) {
    status.value = '请先加载模型';
    return;
  }

  currentModel.updateWorldMatrix(true, true);
  modelInfo.value = collectModelInfo(currentModel, currentGltfMeta, currentFileMeta);
  nodeRows.value = collectRoleNodeRows(currentModel);
  pruneCollapsedNodeUuids();
  applyModelAppearance();
  if (!nodeRows.value.some((node) => node.uuid === selectedNodeUuid.value)) {
    selectedNodeUuid.value = nodeRows.value[0]?.uuid ?? '';
  }
  updateSelectionBox();
  status.value = `结构已刷新：共 ${nodeRows.value.length} 个节点`;
}

function exportStructure() {
  if (!currentModel || !modelInfo.value || nodeRows.value.length === 0) {
    status.value = '请先加载模型';
    return;
  }

  const payload = createStructureExport({
    modelInfo: modelInfo.value,
    nodes: nodeRows.value,
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${modelInfo.value.fileName.replace(/\.glb$/i, '') || 'model'}-structure.json`;
  link.click();
  URL.revokeObjectURL(url);
  status.value = `模型结构已导出：${payload.nodeCount} 个节点`;
}

function exportPose() {
  if (!currentModel || !modelInfo.value || nodeRows.value.length === 0) {
    status.value = '请先加载模型';
    return;
  }

  refreshStructureAfterTransform();
  const payload = createPoseExport({
    modelName: modelInfo.value.fileName,
    nodes: nodeRows.value,
  });
  downloadJson(
    payload,
    `${modelInfo.value.fileName.replace(/\.glb$/i, '') || 'model'}-pose.json`,
  );
  status.value = `当前姿态已导出：${payload.nodeCount} 个节点`;
}

async function exportEditedModel() {
  stopMotionPlayback();
  if (!currentModel || !modelInfo.value) {
    status.value = '请先加载模型';
    return;
  }

  try {
    status.value = '正在导出模型...';
    currentModel.updateWorldMatrix?.(true, true);
    refreshStructureAfterTransform();
    const payload = await exportModelAsGlb(currentModel);
    const fileName = createEditedGlbFileName(modelInfo.value.fileName);
    downloadBinary(payload, fileName, 'model/gltf-binary');
    status.value = `模型已导出：${fileName}`;
  } catch (error) {
    console.error(error);
    status.value = '模型导出失败';
  }
}

function downloadJson(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadBinary(payload, fileName, type) {
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function selectNode(uuid) {
  const object = findObjectByUuid(uuid);
  if (isNodeEffectivelyHidden(object, hiddenNodeUuids.value, currentModel)) {
    status.value = '隐藏节点不可选中';
    return;
  }

  selectedNodeUuid.value = uuid;
  resetTransformModeForSelection();
  syncTransformDraftFromSelection();
  updateSelectionBox();
  closeContextMenu();
}

async function copyNodeName(node) {
  const result = await copyNodeNameToClipboard(node, getBrowserClipboard());
  status.value = result.ok
    ? `已复制节点名称：${result.text}`
    : result.error;
}

function addPartObject3D(parent = currentModel, options = {}) {
  stopMotionPlayback();
  if (!currentModel) {
    status.value = '请先加载模型';
    return;
  }

  const targetParent = parent?.isObject3D ? parent : currentModel;
  pushModelHistory();
  const object = createPartObject3D(currentModel, targetParent, options);
  selectedNodeUuid.value = object.uuid;
  resetTransformModeForSelection();
  originalNodeTransforms = captureOriginalNodeTransforms(currentModel);
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  status.value = `已在 ${targetParent.name || '模型根节点'} 下新增 Object3D：${object.name}`;
  saveCurrentSessionState();
}

function addPartObject3DToNode(uuid) {
  const sibling = findObjectByUuid(uuid);
  if (!sibling) {
    status.value = '没有找到要新建 Object3D 的参考节点';
    return;
  }

  stopMotionPlayback();
  if (!currentModel) {
    status.value = '请先加载模型';
    return;
  }

  pushModelHistory();
  const object = createSiblingPartObject3D(currentModel, sibling);
  selectedNodeUuid.value = object.uuid;
  resetTransformModeForSelection();
  originalNodeTransforms = captureOriginalNodeTransforms(currentModel);
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  status.value = `已在 ${sibling.name || '(未命名)'} 同级新增 Object3D：${object.name}`;
  saveCurrentSessionState();
}

function canRenameNode(node) {
  return isViewerCreatedObject3D(findObjectByUuid(node.uuid));
}

function renameNodeFromEvent(node, event) {
  const object = findObjectByUuid(node.uuid);
  if (String(event.target.value ?? '').trim()) pushModelHistory();
  const result = renameCreatedObject3D(currentModel, object, event.target.value);
  if (!result.ok) {
    event.target.value = node.displayName;
    status.value = result.reason;
    return;
  }

  selectedNodeUuid.value = object.uuid;
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  status.value = `已重命名 Object3D：${result.name}`;
  saveCurrentSessionState();
}

function pushModelHistory() {
  if (!currentModel || isUndoingModelEdit) return;

  const nextStack = [...undoStack.value, captureModelEditState(currentModel)];
  undoStack.value = nextStack.slice(-MAX_UNDO_STEPS);
}

function undoModelEdit() {
  if (!currentModel || undoStack.value.length === 0) {
    status.value = '没有可返回的上一步';
    return;
  }

  const previousState = undoStack.value.at(-1);
  undoStack.value = undoStack.value.slice(0, -1);
  isUndoingModelEdit = true;
  try {
    restoreModelEditState(currentModel, previousState);
  } finally {
    isUndoingModelEdit = false;
  }

  if (!findObjectByUuid(selectedNodeUuid.value)) {
    selectedNodeUuid.value = currentModel.uuid;
  }
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  status.value = '已返回上一步';
  saveCurrentSessionState();
}

function resetSelectedNodeTransform() {
  const object = findObjectByUuid(selectedNodeUuid.value);
  if (!currentModel || !object) {
    status.value = '请先选择节点';
    return;
  }

  pushModelHistory();
  if (!resetNodeTransform(object, originalNodeTransforms)) {
    undoStack.value = undoStack.value.slice(0, -1);
    status.value = '当前节点没有可重置的初始状态';
    return;
  }

  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  status.value = `已局部重置：${object.name || '(未命名)'}`;
  saveCurrentSessionState();
}

function resetModelTransform() {
  if (!currentModel) {
    status.value = '请先加载模型';
    return;
  }

  pushModelHistory();
  const count = resetAllNodeTransforms(currentModel, originalNodeTransforms);
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  status.value = `已重置模型：${count} 个节点`;
  saveCurrentSessionState();
}

function canDragNode(node) {
  return Boolean(modelReady.value && currentModel && node.uuid !== currentModel.uuid);
}

function canDropOnNode(node) {
  const sourceNode = nodeRows.value.find((row) => row.uuid === draggedNodeUuid.value)
    ?? { uuid: draggedNodeUuid.value };
  const placement = dragOverPlacement.value || NODE_DROP_PLACEMENTS.INSIDE;
  return canDropOnNodeAtPlacement(sourceNode, node, placement);
}

function canDropOnNodeAtPlacement(sourceNode, targetNode, placement) {
  if (!modelReady.value || !currentModel) return false;
  if (placement === NODE_DROP_PLACEMENTS.INSIDE) {
    return canDropNodeOnTarget(sourceNode, targetNode);
  }

  return Boolean(
    sourceNode?.uuid
      && targetNode?.uuid
      && sourceNode.uuid !== targetNode.uuid
      && targetNode.depth > 0,
  );
}

function isNodeDropPlacement(node, placement) {
  return dragOverNodeUuid.value === node.uuid && dragOverPlacement.value === placement;
}

function canCollapseNode(node) {
  return node.type === 'Object3D' && node.childCount > 0;
}

function isNodeCollapsed(uuid) {
  return collapsedNodeUuids.value.has(uuid);
}

function toggleNodeCollapse(node) {
  if (!canCollapseNode(node)) return;

  const nextCollapsed = new Set(collapsedNodeUuids.value);
  if (nextCollapsed.has(node.uuid)) {
    nextCollapsed.delete(node.uuid);
  } else {
    nextCollapsed.add(node.uuid);
  }
  collapsedNodeUuids.value = nextCollapsed;
  status.value = nextCollapsed.has(node.uuid)
    ? `已折叠 Object3D：${node.displayName}`
    : `已展开 Object3D：${node.displayName}`;
}

function isNodeHidden(node) {
  return hiddenNodeUuids.value.has(node.uuid);
}

function toggleNodeVisibility(node) {
  const object = findObjectByUuid(node.uuid);
  if (!object || object === currentModel) return;

  hiddenNodeUuids.value = toggleHiddenNode(object, hiddenNodeUuids.value);
  applyModelAppearance();

  if (isNodeEffectivelyHidden(findObjectByUuid(selectedNodeUuid.value), hiddenNodeUuids.value, currentModel)) {
    selectedNodeUuid.value = '';
    syncTransformDraftFromSelection();
    updateSelectionBox();
  }

  status.value = hiddenNodeUuids.value.has(node.uuid)
    ? `已隐藏节点：${node.displayName}`
    : `已显示节点：${node.displayName}`;
  saveCurrentSessionState();
}

function hideAllNodes() {
  if (!currentModel) {
    status.value = '请先加载模型';
    return;
  }

  hiddenNodeUuids.value = createAllHiddenNodeSet(currentModel);
  applyModelAppearance();
  if (isNodeEffectivelyHidden(findObjectByUuid(selectedNodeUuid.value), hiddenNodeUuids.value, currentModel)) {
    selectedNodeUuid.value = '';
    syncTransformDraftFromSelection();
    updateSelectionBox();
  }
  status.value = `已隐藏全部节点：${hiddenNodeUuids.value.size} 个`;
  saveCurrentSessionState();
}

function toggleSearchModelOnly() {
  if (!hasNodeKeyword.value) return;

  isSearchModelOnly.value = !isSearchModelOnly.value;
  applyModelAppearance();
  status.value = isSearchModelOnly.value
    ? `已只显示搜索匹配模型：${filteredNodeRows.value.length} 个节点`
    : '已恢复显示完整模型';
}

function setTransformControlMode(mode) {
  transformControlMode.value = normalizeTransformMode(mode);
  updateTransformControls();
}

function resetTransformModeForSelection() {
  transformControlMode.value = DEFAULT_TRANSFORM_MODE;
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
  });
}

function closeContextMenu() {
  if (!nodeContextMenu.value.open) return;
  nodeContextMenu.value = closeNodeContextMenu();
}

function handleContextMenuAction(action) {
  const uuid = nodeContextMenu.value.nodeUuid;
  closeContextMenu();

  if (action === 'create-object3d') addPartObject3DToNode(uuid);
  if (action === 'edit-script') openScriptDialog(uuid);
  if (action === 'show-info') openInfoDialog(uuid);
  if (action === 'delete') deleteNodeByUuid(uuid);
  if (action === 'focus') focusNodeByUuid(uuid);
}

function openInfoDialog(uuid) {
  const row = nodeRows.value.find((node) => node.uuid === uuid);
  if (!row) return;

  infoDialog.value = {
    open: true,
    nodeUuid: uuid,
    collapsed: new Set(),
  };
}

function closeInfoDialog() {
  infoDialog.value = createClosedInfoDialog();
}

function isInfoSectionCollapsed(key) {
  return infoDialog.value.collapsed.has(key);
}

function toggleInfoSection(key) {
  const collapsed = new Set(infoDialog.value.collapsed);
  if (collapsed.has(key)) {
    collapsed.delete(key);
  } else {
    collapsed.add(key);
  }
  infoDialog.value = {
    ...infoDialog.value,
    collapsed,
  };
}

function deleteNodeByUuid(uuid) {
  const object = findObjectByUuid(uuid);
  if (!object) return;

  pushModelHistory();
  const result = deleteCreatedObject3D(currentModel, object);
  if (!result.ok) {
    undoStack.value = undoStack.value.slice(0, -1);
    status.value = result.reason;
    return;
  }

  if (selectedNodeUuid.value === uuid) {
    selectedNodeUuid.value = '';
  }
  hiddenNodeUuids.value = new Set([...hiddenNodeUuids.value].filter((hiddenUuid) => hiddenUuid !== uuid));
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  status.value = `已删除节点：${object.name || '(未命名)'}`;
  saveCurrentSessionState();
}

function focusNodeByUuid(uuid) {
  const object = findObjectByUuid(uuid);
  if (!object) return;

  const target = createNodeFocusTarget(object, camera);
  if (!applyNodeFocusTarget(camera, controls, target)) {
    status.value = '无法聚焦该节点。';
    return;
  }
  status.value = `已聚焦节点：${object.name || '(未命名)'}`;
}

function startStructureResize(event) {
  if (window.innerWidth <= 980) return;

  isResizingStructurePanel = true;
  window.addEventListener('pointermove', handleStructureResizeMove);
  window.addEventListener('pointerup', stopStructureResize);
  handleStructureResizeMove(event);
}

function handleStructureResizeMove(event) {
  if (!isResizingStructurePanel) return;
  structurePanelWidth.value = clampPanelWidth(event.clientX);
}

function stopStructureResize() {
  isResizingStructurePanel = false;
  window.removeEventListener('pointermove', handleStructureResizeMove);
  window.removeEventListener('pointerup', stopStructureResize);
}

function handleNodeDragStart(event, uuid) {
  if (!currentModel || uuid === currentModel.uuid) {
    event.preventDefault();
    return;
  }

  draggedNodeUuid.value = uuid;
  dragOverPlacement.value = '';
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', uuid);
}

function handleNodeDragOver(event, node) {
  const placement = getNodeDropPlacement(
    event.clientY,
    event.currentTarget?.getBoundingClientRect?.(),
  );
  const sourceNode = nodeRows.value.find((row) => row.uuid === draggedNodeUuid.value)
    ?? { uuid: draggedNodeUuid.value };
  if (!canDropOnNodeAtPlacement(sourceNode, node, placement)) {
    if (dragOverNodeUuid.value === node.uuid) {
      dragOverNodeUuid.value = '';
      dragOverPlacement.value = '';
    }
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  dragOverNodeUuid.value = node.uuid;
  dragOverPlacement.value = placement;
}

function handleNodeDragLeave(node) {
  if (dragOverNodeUuid.value === node.uuid) {
    dragOverNodeUuid.value = '';
    dragOverPlacement.value = '';
  }
}

function handleNodeDragEnd() {
  draggedNodeUuid.value = '';
  dragOverNodeUuid.value = '';
  dragOverPlacement.value = '';
}

function handleNodeDrop(event, targetUuid) {
  event.preventDefault();
  const sourceUuid = event.dataTransfer.getData('text/plain') || draggedNodeUuid.value;
  const placement = dragOverNodeUuid.value === targetUuid
    ? dragOverPlacement.value
    : getNodeDropPlacement(event.clientY, event.currentTarget?.getBoundingClientRect?.());
  draggedNodeUuid.value = '';
  dragOverNodeUuid.value = '';
  dragOverPlacement.value = '';

  if (!currentModel || !sourceUuid || !targetUuid || sourceUuid === targetUuid) return;

  stopMotionPlayback();
  const source = findObjectByUuid(sourceUuid);
  const target = findObjectByUuid(targetUuid);
  pushModelHistory();
  const result = placement === NODE_DROP_PLACEMENTS.INSIDE
    ? moveNodeToObject3D(currentModel, source, target)
    : moveNodeNextToObject3D(currentModel, source, target, placement);
  if (!result.ok) {
    undoStack.value = undoStack.value.slice(0, -1);
    status.value = result.reason;
    return;
  }

  selectedNodeUuid.value = placement === NODE_DROP_PLACEMENTS.INSIDE ? target.uuid : source.uuid;
  resetTransformModeForSelection();
  originalNodeTransforms = captureOriginalNodeTransforms(currentModel);
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  status.value = createNodeDropStatus(source, target, placement, result.moved);
  saveCurrentSessionState();
}

function createNodeDropStatus(source, target, placement, moved) {
  const sourceName = source?.name || '(未命名)';
  const targetName = target?.name || '(未命名)';

  if (placement === NODE_DROP_PLACEMENTS.BEFORE) {
    return moved ? `已把 ${sourceName} 移到 ${targetName} 前面` : `${sourceName} 已在 ${targetName} 前面`;
  }
  if (placement === NODE_DROP_PLACEMENTS.AFTER) {
    return moved ? `已把 ${sourceName} 移到 ${targetName} 后面` : `${sourceName} 已在 ${targetName} 后面`;
  }

  return moved ? `已把 ${sourceName} 放入 ${targetName}` : `${sourceName} 已在 ${targetName} 中`;
}

function syncTransformDraftFromSelection() {
  const object = findObjectByUuid(selectedNodeUuid.value);
  if (!object) {
    transformDraft.value = createEmptyTransform();
    return;
  }

  transformDraft.value = cloneTransform(readNodeTransform(object));
}

function openScriptDialog(uuid) {
  const object = findObjectByUuid(uuid);
  const row = nodeRows.value.find((node) => node.uuid === uuid);
  if (!object || !row) return;

  const currentTransform = cloneTransform(readNodeTransform(object));
  const position = clampDialogPosition({
    x: window.innerWidth - 820,
    y: 72,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    dialogWidth: 760,
    dialogHeight: 560,
  });
  scriptDialog.value = {
    open: true,
    nodeUuid: uuid,
    nodeTitle: row.displayName,
    nodeType: row.type,
    nodePath: row.path,
    script: getBoundNodeControlScript(object) || createTransformScript(currentTransform),
    message: hasBoundNodeControlScript(object) ? '当前节点已绑定脚本。' : '可以编辑并执行当前节点脚本。',
    messageType: 'hint',
    x: position.x,
    y: position.y,
  };
}

function closeScriptDialog() {
  stopScriptDialogDrag();
  scriptDialog.value = createClosedScriptDialog();
}

function startScriptDialogDrag(event) {
  if (event.button !== 0) return;

  event.preventDefault();
  scriptDialogDrag.value = startDialogDrag({
    pointerX: event.clientX,
    pointerY: event.clientY,
    dialogX: scriptDialog.value.x,
    dialogY: scriptDialog.value.y,
  });
  window.addEventListener('pointermove', handleScriptDialogDragMove);
  window.addEventListener('pointerup', stopScriptDialogDrag);
}

function handleScriptDialogDragMove(event) {
  const position = moveDialogByPointer(scriptDialogDrag.value, {
    pointerX: event.clientX,
    pointerY: event.clientY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    dialogWidth: 760,
    dialogHeight: 560,
  });
  if (!position) return;

  scriptDialog.value = {
    ...scriptDialog.value,
    ...position,
  };
}

function stopScriptDialogDrag() {
  scriptDialogDrag.value = stopDialogDrag();
  window.removeEventListener('pointermove', handleScriptDialogDragMove);
  window.removeEventListener('pointerup', stopScriptDialogDrag);
}

function handleScriptEditorKeydown(event) {
  if (isRunShortcut(event)) {
    event.preventDefault();
    executeDialogScript();
    return;
  }

  if (event.key !== 'Tab') return;

  event.preventDefault();
  insertScriptText('  ');
}

function insertScriptSnippet(snippet) {
  insertScriptText(`${scriptDialog.value.script.trim() ? '\n' : ''}${snippet.code}`);
}

function insertScriptText(text) {
  const editor = scriptEditorRef.value;
  const result = insertTextAtSelection(
    scriptDialog.value.script,
    editor?.selectionStart ?? scriptDialog.value.script.length,
    editor?.selectionEnd ?? scriptDialog.value.script.length,
    text,
  );

  scriptDialog.value = {
    ...scriptDialog.value,
    script: result.value,
  };

  nextTick(() => {
    if (!scriptEditorRef.value) return;

    scriptEditorRef.value.focus();
    scriptEditorRef.value.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
}

function handleScriptEditorScroll(event) {
  scriptEditorScrollTop.value = event.target.scrollTop;
}

function executeDialogScript() {
  stopMotionPlayback();
  const object = findObjectByUuid(scriptDialog.value.nodeUuid);
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error');
    return false;
  }

  const result = runNodeControlScript(object, scriptDialog.value.script, { scene });
  if (!result.ok) {
    updateScriptDialogMessage(`脚本执行失败：${result.error}`, 'error');
    return false;
  }

  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  updateScriptDialogMessage(`脚本已应用到节点：${object.name || '(未命名)'}`, 'success');
  status.value = scriptDialog.value.message;
  saveCurrentSessionState();
  return true;
}

function saveDialogScript() {
  const object = findObjectByUuid(scriptDialog.value.nodeUuid);
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error');
    return;
  }
  if (!scriptDialog.value.script.trim()) {
    updateScriptDialogMessage('请先输入要保存的脚本。', 'error');
    return;
  }

  const result = bindNodeControlScript(object, scriptDialog.value.script);
  if (!result.ok) {
    updateScriptDialogMessage(`脚本保存失败：${result.error}`, 'error');
    return;
  }

  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  updateScriptDialogMessage(`脚本已保存到节点：${object.name || '(未命名)'}`, 'success');
  status.value = scriptDialog.value.message;
  saveCurrentSessionState();
}

function clearDialogScript() {
  const object = findObjectByUuid(scriptDialog.value.nodeUuid);
  if (!object) {
    updateScriptDialogMessage('请先选择节点。', 'error');
    return;
  }

  const result = clearNodeControlScript(object);
  if (!result.ok) {
    updateScriptDialogMessage(`清除绑定失败：${result.error}`, 'error');
    return;
  }

  scriptDialog.value.script = createTransformScript(readNodeTransform(object));
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  updateScriptDialogMessage(`已清除节点脚本：${object.name || '(未命名)'}`, 'success');
  status.value = scriptDialog.value.message;
  saveCurrentSessionState();
}

function resetScriptCanvasHelpers() {
  if (typeof window !== 'undefined') {
    const motionStore = window.__tailBeamMotionStore;
    if (motionStore?.frameId) {
      window.cancelAnimationFrame(motionStore.frameId);
    }
    window.__tailBeamMotionStore = { frameId: 0 };
  }

  const removed = removeScriptDebugHelpers(scene);
  let resetCount = 0;

  if (currentModel) {
    pushModelHistory();
    resetCount = resetAllNodeTransforms(currentModel, originalNodeTransforms);
    motionProgress.value = 0;
    isMotionPlaying.value = false;
    motionMessage.value = '已重置模型动作。';
    refreshStructureAfterTransform();
    syncTransformDraftFromSelection();
    saveCurrentSessionState();
  }

  updateScriptDialogMessage(
    `已重置画布：恢复 ${resetCount} 个模型节点，清除 ${removed} 个脚本辅助对象。`,
    'success'
  );
  status.value = scriptDialog.value.message;
}

function hideScriptTriangleHelpers() {
  const removed = removeScriptDebugHelpers(scene);
  updateScriptDialogMessage(
    removed > 0 ? `已隐藏 ${removed} 个三角形辅助对象。` : '当前没有显示的三角形辅助对象。',
    'success'
  );
  status.value = scriptDialog.value.message;
}

function updateScriptDialogMessage(message, messageType) {
  scriptDialog.value = {
    ...scriptDialog.value,
    message,
    messageType,
  };
}

async function handlePoseFileChange(event, role) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const result = normalizePosePayload(payload);
    if (!result.ok) {
      motionMessage.value = result.error;
      status.value = result.error;
      return;
    }

    if (role === 'start') {
      startPose.value = result.pose;
      motionProgress.value = 0;
    } else {
      endPose.value = result.pose;
      motionProgress.value = 1;
    }

    motionMessage.value = `${role === 'start' ? '起始' : '结束'}姿态已导入：${file.name}，${result.pose.nodeCount} 个节点`;
    status.value = motionMessage.value;
  } catch (error) {
    motionMessage.value = `姿态文件读取失败：${error.message}`;
    status.value = motionMessage.value;
  } finally {
    event.target.value = '';
  }
}

function applyImportedPose(role) {
  const pose = role === 'start' ? startPose.value : endPose.value;
  if (!currentModel || !pose) {
    motionMessage.value = `请先导入${role === 'start' ? '起始' : '结束'}姿态。`;
    return;
  }

  stopMotionPlayback();
  const result = applyPoseToModel(currentModel, pose);
  refreshStructureAfterTransform();
  syncTransformDraftFromSelection();
  motionProgress.value = role === 'start' ? 0 : 1;
  motionMessage.value = `已应用${role === 'start' ? '起始' : '结束'}姿态：${result.applied} 个节点`;
  status.value = motionMessage.value;
  saveCurrentSessionState();
}

function toggleMotionPlayback() {
  if (!currentModel) {
    motionMessage.value = '请先加载模型。';
    return;
  }

  isMotionPlaying.value = !isMotionPlaying.value;
  motionStartedAt = performance.now() - motionProgress.value * 2600;
  motionMessage.value = isMotionPlaying.value
    ? '正在播放动作草案。'
    : '动作播放已停止，可以继续拖动进度。';
}

function stopMotionPlayback() {
  isMotionPlaying.value = false;
}

function updateMotionPlayback() {
  if (!isMotionPlaying.value || !currentModel) return;

  const elapsed = (performance.now() - motionStartedAt) / 2600;
  const phase = elapsed % 2;
  const progress = phase <= 1 ? phase : 2 - phase;
  applyMotionProgress(progress, { silent: true, lightRefresh: true });
}

function handleMotionProgressInput() {
  stopMotionPlayback();
  applyMotionProgress(motionProgress.value);
  scheduleCurrentSessionStateSave();
}

function resetMotionPose() {
  stopMotionPlayback();
  applyMotionProgress(0);
  motionMessage.value = canUsePoseMotion.value ? '动作已回到导入的起始姿态。' : '动作已回到初始姿态。';
  status.value = motionMessage.value;
  saveCurrentSessionState();
}

function applyMotionProgress(progress, { silent = false, lightRefresh = false } = {}) {
  if (!currentModel) {
    motionMessage.value = '请先加载模型。';
    return;
  }

  const nextProgress = clampMotionProgress(Number(progress));
  motionProgress.value = Math.round(nextProgress * 1000) / 1000;
  isApplyingMotion = true;
  let result;
  try {
    result = canUsePoseMotion.value
      ? applyPoseTransition(currentModel, startPose.value, endPose.value, nextProgress)
      : applyMechanismMotion(currentModel, originalNodeTransforms, nextProgress);

    if (lightRefresh) {
      currentModel.updateWorldMatrix(true, true);
      selectionBox?.update?.();
      syncTransformDraftFromSelection();
    } else {
      refreshStructureAfterTransform();
      syncTransformDraftFromSelection();
    }
  } finally {
    isApplyingMotion = false;
  }

  if (!silent) {
    const appliedCount = Array.isArray(result.applied) ? result.applied.length : result.applied;
    motionMessage.value = canUsePoseMotion.value
      ? `已应用姿态动作：${Math.round(nextProgress * 100)}%，匹配 ${appliedCount} 个节点。`
      : `已应用动作进度：${Math.round(nextProgress * 100)}%，驱动 ${appliedCount} 个机构总成。`;
    status.value = motionMessage.value;
  }
}

function refreshStructureAfterTransform() {
  if (!currentModel) return;

  currentModel.updateWorldMatrix(true, true);
  modelInfo.value = collectModelInfo(currentModel, currentGltfMeta, currentFileMeta);
  nodeRows.value = collectRoleNodeRows(currentModel);
  pruneCollapsedNodeUuids();
  pruneHiddenNodeUuids();
  applyModelAppearance();
  updateSelectionBox();
}

function updateTransformControls() {
  if (!transformControls || !transformControlsHelper) return;

  const object = findObjectByUuid(selectedNodeUuid.value);
  if (!showTransformGizmo.value || !object) {
    transformControls.detach();
    transformControlsHelper.visible = false;
    return;
  }

  transformControls.setMode(transformControlMode.value);
  transformControls.setSpace('local');
  transformControls.attach(object);
  transformControlsHelper.visible = true;
}

function handleTransformControlDragging(event) {
  if (controls) controls.enabled = !event.value;
  if (event.value) {
    didTransformControlChange = false;
    return;
  }

  if (didTransformControlChange) {
    didTransformControlChange = false;
    cancelScheduledSessionSave();
    saveCurrentSessionState();
  }
}

function handleTransformControlMouseDown() {
  if (!findObjectByUuid(selectedNodeUuid.value)) return;
  pushModelHistory();
}

function handleTransformControlObjectChange() {
  const object = findObjectByUuid(selectedNodeUuid.value);
  if (!object) return;

  transformDraft.value = cloneTransform(readNodeTransform(object));
  refreshStructureAfterTransform();
  didTransformControlChange = true;
  scheduleCurrentSessionStateSave();
}

function toggleWireframe() {
  isWireframe.value = !isWireframe.value;
  applyModelAppearance();
  status.value = isWireframe.value ? '已打开线框显示' : '已关闭线框显示';
}

function toggleGrid() {
  showGrid.value = !showGrid.value;
  if (grid) grid.visible = showGrid.value;
}

function toggleModelVisibility() {
  showModel.value = !showModel.value;
  applyModelAppearance();
  status.value = showModel.value ? '模型已显示' : '模型已隐藏';
}

function toggleModelTransparency() {
  isModelTransparent.value = !isModelTransparent.value;
  applyModelAppearance();
  status.value = isModelTransparent.value ? '模型已半透明' : '模型已恢复不透明';
}

function restoreCurrentSessionState() {
  if (!currentModel) return { restored: 0, created: 0 };

  const state = loadModelSessionState(getBrowserSessionStorage(), currentSessionModelName());
  const result = restoreModelSessionState(currentModel, state);
  if (result.restored <= 0) return result;

  hiddenNodeUuids.value = result.hiddenNodeUuids;
  selectedNodeUuid.value = result.selectedNodeUuid || selectedNodeUuid.value;
  return result;
}

function saveCurrentSessionState() {
  cancelScheduledSessionSave();
  if (!currentModel) return false;

  const state = captureModelSessionState(currentModel, {
    modelName: currentSessionModelName(),
    selectedNodeUuid: selectedNodeUuid.value,
    hiddenNodeUuids: hiddenNodeUuids.value,
  });
  return saveModelSessionState(getBrowserSessionStorage(), currentSessionModelName(), state);
}

function scheduleCurrentSessionStateSave() {
  if (!currentModel || typeof window === 'undefined') return;

  cancelScheduledSessionSave();
  sessionSaveTimer = window.setTimeout(() => {
    sessionSaveTimer = 0;
    saveCurrentSessionState();
  }, 150);
}

function cancelScheduledSessionSave() {
  if (!sessionSaveTimer || typeof window === 'undefined') return;

  window.clearTimeout(sessionSaveTimer);
  sessionSaveTimer = 0;
}

function clearCurrentSessionState() {
  const cleared = clearModelSessionState(getBrowserSessionStorage(), currentSessionModelName());
  status.value = cleared ? '已清除当前模型的会话保存' : '当前环境无法清除会话保存';
}

function currentSessionModelName() {
  return currentFileMeta?.name || 'model.glb';
}

function getBrowserSessionStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getBrowserClipboard() {
  if (typeof navigator === 'undefined') return null;

  return navigator.clipboard ?? null;
}

function resetView() {
  if (currentModel) {
    fitCameraToModel(currentModel);
  } else {
    camera.position.set(8, 6, 8);
    controls.target.set(0, 0, 0);
    controls.update();
  }
  status.value = '视角已重置';
}

function handleCanvasPointerDown(event) {
  pickStart = {
    x: event.clientX,
    y: event.clientY,
    button: event.button,
  };
}

function handleCanvasPointerUp(event) {
  if (!currentModel || !raycaster || !pointer || !pickStart) return;
  if (pickStart.button !== 0 || event.button !== 0) return;

  const moveDistance = Math.hypot(event.clientX - pickStart.x, event.clientY - pickStart.y);
  pickStart = null;
  if (moveDistance > 4) return;

  const hitObject = pickModelObject(event);
  if (!hitObject) return;

  const uuid = findSelectableNodeUuid(hitObject, nodeRows.value, hiddenNodeUuids.value);
  if (!uuid) return;

  selectNode(uuid);
  const object = findObjectByUuid(uuid);
  status.value = `已从模型选中：${object?.name || hitObject.name || '(未命名)'}`;
}

function pickModelObject(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObject(currentModel, true);
  return hits.find((hit) => hit.object?.isMesh)?.object ?? null;
}

function fitCameraToModel(model) {
  const box = new Box3().setFromObject(model);
  if (box.isEmpty()) return;

  lastBox = box;
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const distance = maxSize * 2.1;

  camera.near = Math.max(distance / 200, 0.01);
  camera.far = distance * 100;
  camera.position.set(center.x + distance, center.y + distance * 0.65, center.z + distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();

  if (grid) {
    grid.scale.setScalar(Math.max(maxSize / 5, 1));
    grid.position.y = box.min.y - maxSize * 0.02;
  }
}

function prepareMaterialStates(model) {
  materialStates = new Map();
  model.traverse((object) => {
    if (!object.isMesh) return;
    materialList(object.material).forEach((material) => {
      if (materialStates.has(material)) return;
      materialStates.set(material, {
        wireframe: Boolean(material.wireframe),
        transparent: Boolean(material.transparent),
        opacity: material.opacity ?? 1,
        depthWrite: material.depthWrite ?? true,
      });
    });
  });
}

function applyModelAppearance() {
  if (!currentModel) return;

  const searchVisibleUuids = isSearchModelOnly.value
    ? collectSearchVisibleNodeUuids(nodeRows.value, nodeKeyword.value)
    : null;

  currentModel.traverse((object) => {
    if (!object.isMesh) return;

    object.visible = showModel.value
      && !isNodeEffectivelyHidden(object, hiddenNodeUuids.value, currentModel)
      && (!searchVisibleUuids || searchVisibleUuids.has(object.uuid));
    materialList(object.material).forEach((material) => {
      const original = materialStates.get(material);
      material.wireframe = isWireframe.value || original?.wireframe || false;
      material.transparent = isModelTransparent.value || original?.transparent || false;
      material.opacity = isModelTransparent.value ? 0.28 : original?.opacity ?? 1;
      material.depthWrite = isModelTransparent.value ? false : original?.depthWrite ?? true;
      material.needsUpdate = true;
    });
  });
}

function updateSelectionBox() {
  if (selectionBox) {
    scene.remove(selectionBox);
    selectionBox.geometry?.dispose?.();
    selectionBox.material?.dispose?.();
    selectionBox = null;
  }

  const object = findObjectByUuid(selectedNodeUuid.value);
  if (!object) {
    updateTransformControls();
    return;
  }

  selectionBox = new BoxHelper(object, '#facc15');
  selectionBox.name = '选中节点包围框';
  scene.add(selectionBox);
  updateTransformControls();
  status.value = `已选中节点：${object.name || '(未命名)'}`;
}

function findObjectByUuid(uuid) {
  if (!currentModel || !uuid) return null;

  let found = null;
  currentModel.traverse((object) => {
    if (object.uuid === uuid) found = object;
  });
  return found;
}

function collectRoleNodeRows(model) {
  return enrichNodeRowsWithRoles(collectNodeRows(model));
}

function pruneCollapsedNodeUuids() {
  if (!collapsedNodeUuids.value.size) return;

  const existingUuids = new Set(nodeRows.value.map((node) => node.uuid));
  collapsedNodeUuids.value = new Set(
    [...collapsedNodeUuids.value].filter((uuid) => existingUuids.has(uuid)),
  );
}

function pruneHiddenNodeUuids() {
  if (!hiddenNodeUuids.value.size) return;

  const existingUuids = new Set(nodeRows.value.map((node) => node.uuid));
  hiddenNodeUuids.value = new Set(
    [...hiddenNodeUuids.value].filter((uuid) => existingUuids.has(uuid)),
  );
}

function disposeCurrentModel() {
  cancelScheduledSessionSave();
  if (selectionBox) {
    scene.remove(selectionBox);
    selectionBox.geometry?.dispose?.();
    selectionBox.material?.dispose?.();
    selectionBox = null;
  }
  transformControls?.detach();
  if (transformControlsHelper) transformControlsHelper.visible = false;

  if (!currentModel) return;

  scene.remove(currentModel);
  currentModel.traverse((object) => {
    object.geometry?.dispose?.();
    materialList(object.material).forEach((material) => material.dispose?.());
  });

  currentModel = null;
  currentGltfMeta = { animations: [] };
  currentFileMeta = { name: 'model.glb', size: 0 };
  originalNodeTransforms = new Map();
  motionProgress.value = 0;
  isMotionPlaying.value = false;
  startPose.value = null;
  endPose.value = null;
  motionMessage.value = '动作演示会按节点名称驱动，不使用手动标点。';
  lastBox = null;
  materialStates = new Map();
  modelReady.value = false;
  modelInfo.value = null;
  nodeRows.value = [];
  collapsedNodeUuids.value = new Set();
  hiddenNodeUuids.value = new Set();
  isSearchModelOnly.value = false;
  undoStack.value = [];
  selectedNodeUuid.value = '';
  nodeKeyword.value = '';
  transformDraft.value = createEmptyTransform();
  scriptDialog.value = createClosedScriptDialog();
  infoDialog.value = createClosedInfoDialog();
}

function materialList(material) {
  if (!material) return [];
  return Array.isArray(material) ? material.filter(Boolean) : [material];
}

function createClosedScriptDialog() {
  return {
    open: false,
    nodeUuid: '',
    nodeTitle: '',
    nodeType: '',
    nodePath: '',
    script: '',
    message: '',
    messageType: 'hint',
    x: 72,
    y: 72,
  };
}

function createClosedInfoDialog() {
  return {
    open: false,
    nodeUuid: '',
    collapsed: new Set(),
  };
}

function createEmptyTransform() {
  return {
    position: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function createTransformScript(transform) {
  const position = transform.position.map(formatScriptNumber).join(', ');
  const rotation = transform.rotationDeg.map(formatScriptNumber).join(', ');
  const scale = transform.scale.map(formatScriptNumber).join(', ');

  return [
    `setPosition(${position});`,
    `setRotationDeg(${rotation});`,
    `setScale(${scale});`,
    '',
    '// 也可以直接操作当前节点：',
    '// node.position.y -= 10;',
    '// node.rotation.z = deg(15);',
  ].join('\n');
}

function formatScriptNumber(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}
</script>

<template>
  <main class="app-shell" :style="appShellStyle" @click="closeContextMenu">
    <aside class="structure-panel">
      <section class="info-section node-section">
        <div class="section-title-row">
          <h2>节点列表</h2>
          <div class="node-title-actions">
            <button type="button" :disabled="!modelReady" @click="addPartObject3D">新建 Object3D</button>
            <button type="button" :disabled="!modelReady" @click="exportEditedModel">导出模型</button>
            <button type="button" :disabled="!modelReady" @click="refreshStructure">刷新</button>
            <button type="button" :disabled="!modelReady" @click="hideAllNodes">全部隐藏</button>
          </div>
        </div>
        <div class="node-tools">
          <input
            v-model="nodeKeyword"
            type="text"
            placeholder="按名称、类型、父节点或路径筛选"
          />
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
          共 {{ nodeRows.length }} 个节点，当前匹配 {{ filteredNodeRows.length }} 个，列表展示 {{ nodePreviewRows.length }} 条。
        </p>

        <ul v-if="nodePreviewRows.length" class="node-list">
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
                <span v-if="node.mechanismRole" class="role-pill">{{ node.mechanismRole.label }}</span>
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
                <span v-if="node.mechanismRole" class="role-pill">{{ node.mechanismRole.label }}</span>
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

    <div
      class="panel-resizer"
      aria-hidden="true"
      @pointerdown.prevent="startStructureResize"
    ></div>

    <section class="viewer-panel">
      <div class="canvas-transform-toolbar" aria-label="节点变换工具" @pointerdown.stop @click.stop>
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
        <span class="toolbar-divider" aria-hidden="true"></span>
        <button
          type="button"
          :disabled="undoStack.length === 0"
          @click="undoModelEdit"
        >
          返回上一步
        </button>
        <button
          type="button"
          :disabled="!selectedNode"
          @click="resetSelectedNodeTransform"
        >
          局部重置
        </button>
        <button
          type="button"
          :disabled="!modelReady"
          @click="resetModelTransform"
        >
          重置
        </button>
      </div>
      <div ref="canvasHost" class="canvas-host" aria-label="GLB 模型预览窗口"></div>
    </section>

    <aside class="side-panel">
      <header class="panel-header">
        <p class="eyebrow">GLB Model Structure</p>
        <h1>模型结构查看器</h1>
        <p>先看清节点、网格、材质和层级关系，再做后续模型操作。</p>
      </header>

      <label class="file-picker">
        <span>选择本地 GLB 文件</span>
        <input type="file" accept=".glb,model/gltf-binary" @change="handleFileChange" />
      </label>

      <div class="status-line" :class="{ loading: isLoading }">{{ status }}</div>

      <section class="info-section">
        <h2>查看控制</h2>
        <div class="button-grid">
          <button type="button" :disabled="!modelReady" @click="toggleWireframe">
            {{ isWireframe ? '关闭线框' : '线框模式' }}
          </button>
          <button type="button" @click="toggleGrid">
            {{ showGrid ? '隐藏网格' : '显示网格' }}
          </button>
          <button type="button" :disabled="!modelReady" @click="toggleModelVisibility">
            {{ showModel ? '隐藏模型' : '显示模型' }}
          </button>
          <button type="button" :disabled="!modelReady" @click="toggleModelTransparency">
            {{ isModelTransparent ? '关闭透明' : '透明模型' }}
          </button>
          <button type="button" @click="resetView">重置视角</button>
          <button type="button" :disabled="!modelReady" @click="exportStructure">导出结构</button>
          <button type="button" :disabled="!modelReady" @click="exportPose">导出姿态</button>
          <button type="button" :disabled="!modelReady" @click="clearCurrentSessionState">清除会话</button>
        </div>
      </section>

      <section class="info-section">
        <h2>动作演示</h2>
        <div class="motion-panel">
          <div class="pose-upload-grid">
            <label>
              <span>{{ startPose ? '起始已导入' : '导入起始姿态' }}</span>
              <input type="file" accept=".json,application/json" :disabled="!modelReady" @change="handlePoseFileChange($event, 'start')" />
            </label>
            <label>
              <span>{{ endPose ? '结束已导入' : '导入结束姿态' }}</span>
              <input type="file" accept=".json,application/json" :disabled="!modelReady" @change="handlePoseFileChange($event, 'end')" />
            </label>
          </div>
          <div class="motion-progress-row">
            <span>{{ canUsePoseMotion ? '姿态进度' : '进度' }}</span>
            <strong>{{ Math.round(motionProgress * 100) }}%</strong>
          </div>
          <input
            v-model.number="motionProgress"
            type="range"
            min="0"
            max="1"
            step="0.01"
            :disabled="!modelReady"
            @input="handleMotionProgressInput"
          />
          <div class="button-grid">
            <button type="button" :disabled="!modelReady" @click="toggleMotionPlayback">
              {{ isMotionPlaying ? '停止动作' : '播放动作' }}
            </button>
            <button type="button" :disabled="!modelReady" @click="resetMotionPose">回到初始</button>
            <button type="button" :disabled="!startPose" @click="applyImportedPose('start')">应用起始</button>
            <button type="button" :disabled="!endPose" @click="applyImportedPose('end')">应用结束</button>
          </div>
          <p class="motion-message">{{ motionMessage }}</p>
        </div>
      </section>

      <section class="info-section">
        <h2>模型信息</h2>
        <dl v-if="modelInfo" class="info-list">
          <div><dt>文件名</dt><dd>{{ modelInfo.fileName }}</dd></div>
          <div><dt>大小</dt><dd>{{ modelInfo.fileSize }}</dd></div>
          <div><dt>节点</dt><dd>{{ modelInfo.nodeCount }}</dd></div>
          <div><dt>网格</dt><dd>{{ modelInfo.meshCount }}</dd></div>
          <div><dt>材质</dt><dd>{{ modelInfo.materialCount }}</dd></div>
          <div><dt>三角面</dt><dd>{{ modelInfo.triangleCount }}</dd></div>
          <div><dt>内置动画</dt><dd>{{ modelInfo.animationCount }}</dd></div>
          <div><dt>包围盒</dt><dd>{{ modelInfo.size }}</dd></div>
          <div><dt>中心点</dt><dd>{{ modelInfo.center.join(', ') }}</dd></div>
        </dl>
        <p v-else class="empty-text">加载模型后显示文件、网格、材质和包围盒信息。</p>
      </section>

      <section class="info-section">
        <h2>机构角色草案</h2>
        <template v-if="roleSummaryRows.length">
          <ul class="role-summary">
            <li v-for="role in roleSummaryRows" :key="role.key">
              <span>{{ role.label }}</span>
              <strong>{{ role.type }}</strong>
              <em>{{ role.nodeCount }} 个节点</em>
            </li>
          </ul>
          <ul class="connection-list compact">
            <li v-for="connection in CONNECTION_DRAFT" :key="`${connection.from}-${connection.to}`">
              <strong>{{ connection.from }}</strong>
              <span>→</span>
              <strong>{{ connection.to }}</strong>
            </li>
          </ul>
        </template>
        <p v-else class="empty-text">加载模型后按节点名称自动生成角色草案。</p>
      </section>

    </aside>

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

    <section
      v-if="scriptDialog.open"
      class="modal-panel script-modal floating-script-modal"
      :style="{ left: `${scriptDialog.x}px`, top: `${scriptDialog.y}px` }"
      @click.stop
    >
        <header class="modal-header draggable-modal-header" @pointerdown="startScriptDialogDrag">
          <div>
            <h2>编辑脚本</h2>
            <p>{{ scriptDialog.nodeTitle }} / {{ scriptDialog.nodeType }}</p>
          </div>
          <button type="button" @pointerdown.stop @click="closeScriptDialog">关闭</button>
        </header>
        <p class="modal-path">{{ scriptDialog.nodePath }}</p>
        <div class="code-toolbar" aria-label="脚本快捷插入">
          <span>插入</span>
          <button
            v-for="snippet in SCRIPT_SNIPPETS"
            :key="snippet.label"
            type="button"
            @pointerdown.stop
            @click="insertScriptSnippet(snippet)"
          >
            {{ snippet.label }}
          </button>
          <em>{{ scriptEditorStats.lines }} 行 / {{ scriptEditorStats.chars }} 字符</em>
        </div>
        <div class="code-editor-shell">
          <ol
            class="code-line-numbers"
            aria-hidden="true"
            :style="{ transform: `translateY(-${scriptEditorScrollTop}px)` }"
          >
            <li v-for="lineNumber in scriptEditorLineNumbers" :key="lineNumber">{{ lineNumber }}</li>
          </ol>
          <textarea
            ref="scriptEditorRef"
            v-model="scriptDialog.script"
            class="code-editor"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            aria-label="节点 JS 脚本"
            @keydown="handleScriptEditorKeydown"
            @scroll="handleScriptEditorScroll"
          ></textarea>
        </div>
        <p class="code-help">可用：node、scene、THREE、setPosition(x,y,z)、setRotationDeg(x,y,z)、setScale(x,y,z)、deg(角度)。按 Ctrl/Command + Enter 执行。</p>
        <div class="modal-actions">
          <button type="button" @click="executeDialogScript">执行</button>
          <button type="button" @click="saveDialogScript">保存绑定</button>
          <button type="button" @click="clearDialogScript">清除绑定</button>
          <button type="button" @click="hideScriptTriangleHelpers">隐藏三角形</button>
          <button type="button" @click="resetScriptCanvasHelpers">重置画布</button>
          <button type="button" @click="closeScriptDialog">关闭</button>
        </div>
        <p class="transform-message" :class="scriptDialogMessageClass">{{ scriptDialog.message }}</p>
    </section>

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
          <section v-for="section in activeInfoSections" :key="section.key" class="info-fold-section">
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
