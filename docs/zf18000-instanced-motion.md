# ZF18000 InstancedMesh 批量显示和脚本运动说明

本文说明 `/zf18000-batch` 页面现在的实现方式，以及后续扩展动作脚本时应该使用的 API。

## 核心结论

`InstancedMesh` 只能高性能绘制同一份 `geometry + material` 的多个实例。它本身不是 300 棵完整的模型树，所以不能直接对某一台实例调用：

```js
node.getObjectByName('flap1_driving_shaft_pos')
```

当前实现把系统分成两层：

```text
显示层：
  多个 InstancedMesh
  每个 InstancedMesh 里有多台支架的矩阵

控制层：
  按需 clone 出隐藏的普通 Object3D 模型
  脚本在隐藏模型里执行
  执行后把隐藏模型的 mesh 矩阵同步回 InstancedMesh
```

也就是说，`InstancedMesh` 负责显示，隐藏控制模型负责计算动作。

## 当前入口

批量页面：

```text
src/pages/Zf18000BatchPage.vue
```

路由：

```text
/zf18000-batch
```

批量参数：

```text
src/zf18000BatchLayout.js
```

当前配置：

```js
export const ZF18000_BATCH_COUNT = 300;
export const ZF18000_BATCH_SPACING = 2;
```

位置由 `createZf18000BatchPositions` 生成：

```js
export function createZf18000BatchPositions({
  count = ZF18000_BATCH_COUNT,
  spacing = ZF18000_BATCH_SPACING,
} = {}) {
  return Array.from({ length: count }, (_, index) => ({
    index,
    x: index * spacing,
    y: 0,
    z: 0,
  }));
}
```

第 1 台支架的位置是 `(0, 0, 0)`，第 2 台是 `(2, 0, 0)`，第 300 台是 `(598, 0, 0)`。

## 显示层 API

文件：

```text
src/zf18000InstancedBatch.js
```

### createZf18000InstancedBatch(templateModel, positions)

作用：把一个模板模型转换成批量 `InstancedMesh` 显示。

调用：

```js
const positions = createZf18000BatchPositions();
const result = createZf18000InstancedBatch(templateModel, positions);
scene.add(result.root);
```

参数：

```text
templateModel
  已加载并整理过结构的 GLB 根节点。

positions
  每台支架的位置数组，格式为：
  { index, x, y, z }
```

返回：

```js
{
  root,          // 包含所有 InstancedMesh 的 Group
  records,       // mesh 名称和 InstancedMesh 的映射表
  meshCount,     // 创建了多少个 InstancedMesh
  instanceCount, // 每个 InstancedMesh 里有多少台支架
}
```

内部流程：

```js
templateModel.traverse((child) => {
  if (!child.isMesh) return;
  if (child.isSkinnedMesh) return;

  const instancedMesh = new InstancedMesh(
    child.geometry,
    child.material,
    positions.length
  );

  positions.forEach((position, index) => {
    modelMatrix.makeTranslation(position.x, position.y, position.z);
    instanceMatrix.multiplyMatrices(modelMatrix, meshLocalMatrix);
    instancedMesh.setMatrixAt(index, instanceMatrix);
  });
});
```

这里每个原始 `Mesh` 会生成一个 `InstancedMesh`。例如当前 ZF18000 模型会生成 37 个 `InstancedMesh`。

### records 的作用

创建每个 `InstancedMesh` 时会记录：

```js
records.push({
  meshName: child.name || '',
  instancedMesh,
});
```

后面同步动作时，会按 `meshName` 找到隐藏控制模型里的同名 mesh，再把它的矩阵写回这个 `instancedMesh`。

## 控制层 API

控制层不是独立文件，主要在：

```text
src/pages/Zf18000BatchPage.vue
```

关键变量：

```js
let controlTemplateModel = null;
const controlRigCache = new Map();
```

含义：

```text
controlTemplateModel
  已加载、已整理 _pos 节点的模板模型。

controlRigCache
  缓存已经创建过的隐藏控制模型。
  key 是实例下标，value 是对应的隐藏控制模型。
```

界面上第 1 台支架，对应内部实例下标 `0`。

## 为什么要 prepareLoadedModelStructure

原始 GLB 里没有 `_pos` 节点。它大概是这种结构：

```text
Flap1
  flap1
  flap1_driving_shaft
  flap1_hydraulic_fixed
  flap1_hydraulic_slidingshaft
  flap1_output_shaft
```

但脚本需要这些节点：

```js
node.getObjectByName('flap1_driving_shaft_pos')
node.getObjectByName('flap1_hydraulic_fixed_pos')
node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
```

所以加载模板模型后，先执行：

```js
prepareLoadedModelStructure(templateModel);
templateModel.updateWorldMatrix(true, true);
```

`prepareLoadedModelStructure` 会调用 `initializeMeshObject3Ds`，给每个 mesh 创建对应的 `_pos` 包装节点。

## 创建隐藏控制模型

函数：

```js
getOrCreateControlRig(instanceIndex)
```

作用：为某一台支架创建或读取隐藏控制模型。

核心代码：

```js
const rig = cloneGltfScene(controlTemplateModel);
rig.name = `ZF18000_control_${instanceIndex + 1}`;
rig.position.set(position.x, position.y, position.z);
rig.updateWorldMatrix(true, true);
```

这里的 `rig` 是完整的普通模型树，不是 `InstancedMesh`。脚本可以在这里正常使用 `getObjectByName`。

创建后会缓存：

```js
controlRigCache.set(instanceIndex, rig);
```

所以同一台支架连续执行脚本时，会延续上一次动作状态。

## 脚本作用节点

当前页面默认支持 `Flap1_ZF18000` 这组脚本。

脚本节点由这个函数决定：

```js
function findFlapScriptNode(rig) {
  return rig.getObjectByName('Flap1') ?? rig.getObjectByName('flap1') ?? rig;
}
```

也就是说，`lookAt.js` 和 `run.js` 默认都在 `Flap1` 节点下执行，而不是在整台支架根节点或者 `InstancedMesh` 上执行。

## lookAt 初始化

脚本文件：

```text
script/Flap1_ZF18000/lookAt.js
```

创建隐藏控制模型后，会先执行：

```js
const lookAtResult = runNodeControlScript(scriptNode, flapLookAtScript, { scene });
```

`lookAt.js` 主要做方向初始化：

```js
const AObject = node.getObjectByName('flap1_driving_shaft_pos')
const BObject = node.getObjectByName('flap1_hydraulic_fixed_pos')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
const DObject = node.getObjectByName('flap1_output_shaft_pos')
const EObject = node.getObjectByName('flap1_pos')

CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
BObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
AObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
DObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
EObject.lookAt(DObject.getWorldPosition(new THREE.Vector3()))
```

执行完 `lookAt` 后，还会整理 mesh 层级：

```js
applyLookAtMeshHierarchy(rig, scriptNode);
```

这一步会把 mesh 放到对应 `_pos` 节点下面。后续 `_pos` 动，mesh 才会跟着动。

## 执行运动脚本

脚本文件：

```text
script/Flap1_ZF18000/run.js
```

页面默认把它放进编辑框：

```js
const scriptSource = ref(flapRunScript.trimEnd());
```

点击“执行脚本”时，会调用：

```js
function executeSelectedScript() {
  const instanceIndex = normalizeSelectedSupportIndex();
  const rigResult = getOrCreateControlRig(instanceIndex);

  const runResult = runNodeControlScript(
    rigResult.scriptNode,
    scriptSource.value,
    { scene }
  );

  const syncResult = syncControlRigToInstancedBatch(
    rigResult.rig,
    instanceIndex,
    instancedRecords,
    batchRoot
  );
}
```

这里有两个阶段：

```text
1. 在隐藏控制模型里执行脚本，修改 _pos 节点
2. 把隐藏控制模型里的 mesh 矩阵同步到 InstancedMesh
```

## 脚本运行 API

执行函数来自：

```text
src/nodeScriptControl.js
```

API：

```js
runNodeControlScript(node, script, context = {})
```

脚本里可以使用这些变量：

```text
node
  当前脚本作用节点。

THREE
  three 模块。

scene
  当前 Three.js 场景。

setPosition(x, y, z)
  设置 node.position。

setRotationDeg(x, y, z)
  用角度设置 node.rotation。

setScale(x, y, z)
  设置 node.scale。

deg(value)
  角度转弧度。
```

当前 `Flap1_ZF18000/run.js` 主要通过 `node.getObjectByName` 找到各个 `_pos` 节点，然后计算 C 点和 D 点的新位置：

```js
const nextBC = Init.BC - STEP * MOVE_DIRECTION
const C = getPointC(nextBC)
setWorldPosition(CObject, C)
const D = getPointD(C)
setWorldPosition(DObject, D)
```

最后再重新调整方向：

```js
customQuaternionLookAt(CObject, BObject.getWorldPosition(new THREE.Vector3()))
customQuaternionLookAt(BObject, CObject.getWorldPosition(new THREE.Vector3()))
customQuaternionLookAt(AObject, CObject.getWorldPosition(new THREE.Vector3()))
customQuaternionLookAt(DObject, CObject.getWorldPosition(new THREE.Vector3()))
customQuaternionLookAt(EObject, DObject.getWorldPosition(new THREE.Vector3()))
```

## 同步回 InstancedMesh

同步函数：

```js
syncControlRigToInstancedBatch(rig, instanceIndex, records, batchRoot)
```

参数：

```text
rig
  隐藏控制模型。

instanceIndex
  要更新第几个实例。第 1 台支架是 0。

records
  createZf18000InstancedBatch 返回的 mesh 映射表。

batchRoot
  包含所有 InstancedMesh 的根 Group。
```

返回：

```js
{
  updated, // 成功同步了多少个 mesh
  missing, // 没有在隐藏控制模型里找到的 mesh 名称
}
```

同步逻辑：

```js
rig.updateWorldMatrix(true, true);
batchRoot.updateWorldMatrix(true, false);

const batchRootInverseMatrix = new Matrix4()
  .copy(batchRoot.matrixWorld)
  .invert();

instanceMatrix.multiplyMatrices(
  batchRootInverseMatrix,
  mesh.matrixWorld
);

record.instancedMesh.setMatrixAt(instanceIndex, instanceMatrix);
record.instancedMesh.instanceMatrix.needsUpdate = true;
```

这段代码的意思是：

```text
隐藏控制模型里的 mesh 世界矩阵
        ↓
转成相对 batchRoot 的矩阵
        ↓
写入对应 InstancedMesh 的第 instanceIndex 个实例
```

关键就是：

```js
setMatrixAt(instanceIndex, instanceMatrix)
```

它只更新某一台支架，不会影响其他实例。

## 选择支架

页面支持两种选择方式：

```text
1. 在右侧输入支架编号
2. 在画面中点击某台支架
```

点击选择使用 `Raycaster`：

```js
const hit = raycaster
  .intersectObjects(batchRoot.children, false)
  .find((item) => Number.isInteger(item.instanceId));

selectedSupportNumber.value = hit.instanceId + 1;
```

`Raycaster` 命中 `InstancedMesh` 时，会返回 `instanceId`。这个值从 0 开始，所以界面显示时加 1。

## 重置当前支架

点击“重置当前”时：

```js
controlRigCache.delete(instanceIndex);
```

然后重新创建这一台的隐藏控制模型，并同步回 `InstancedMesh`。

这只会重置当前编号的支架，不会重置全部。

## 扩展其他部位脚本

当前页面默认只接了：

```text
script/Flap1_ZF18000/lookAt.js
script/Flap1_ZF18000/run.js
```

如果要支持其他部位，例如 `FrontColumn`、`BackColumn`、`TailBeam`，建议抽一份配置：

```js
const SCRIPT_TARGETS = {
  flap1: {
    label: '护帮板',
    nodeNames: ['Flap1', 'flap1'],
    lookAtScript: flapLookAtScript,
    runScript: flapRunScript,
  },
  frontColumn: {
    label: '前立柱',
    nodeNames: ['FrontColumn'],
    lookAtScript: frontColumnLookAtScript,
    runScript: frontColumnRunScript,
  },
};
```

然后把 `findFlapScriptNode` 改成按配置找节点：

```js
function findScriptNode(rig, target) {
  for (const name of target.nodeNames) {
    const object = rig.getObjectByName(name);
    if (object) return object;
  }
  return rig;
}
```

核心流程不用改，仍然是：

```text
隐藏控制模型执行脚本
        ↓
同步 mesh 矩阵
        ↓
更新 InstancedMesh 指定实例
```

## 注意事项

1. 不要对 `InstancedMesh` 调用 `getObjectByName` 来找支架内部节点。

   `InstancedMesh` 不是完整模型树，它没有 `flap1_*_pos` 这些子节点。

2. `records` 依赖 mesh 名称匹配。

   如果 GLB 里多个 mesh 使用同名，当前同步逻辑只会取隐藏控制模型里第一个同名 mesh。后续如果模型存在大量重名 mesh，建议改成保存稳定路径，而不是只用名称。

3. 每次脚本执行后，必须同步矩阵。

   只执行 `runNodeControlScript` 只会改变隐藏控制模型，不会改变画面。必须再调用：

   ```js
   syncControlRigToInstancedBatch(...)
   ```

4. 修改 `instanceMatrix` 后必须设置：

   ```js
   instancedMesh.instanceMatrix.needsUpdate = true;
   ```

5. 当前实现按需创建隐藏控制模型。

   只有执行过脚本或重置过的支架，才会进入 `controlRigCache`。这样不会一开始就 clone 300 套控制模型。

6. 当前脚本编辑器只是一个简单文本框。

   它没有语法提示，也没有脚本列表管理。如果需要完整编辑体验，可以复用主编辑器里的 `ScriptCodeEditor.vue`。

## 推荐使用方式

静态显示：

```js
const positions = createZf18000BatchPositions();
const result = createZf18000InstancedBatch(templateModel, positions);
scene.add(result.root);
```

执行某台支架动作：

```js
const instanceIndex = selectedSupportNumber - 1;
const rigResult = getOrCreateControlRig(instanceIndex);

runNodeControlScript(rigResult.scriptNode, scriptSource, { scene });

syncControlRigToInstancedBatch(
  rigResult.rig,
  instanceIndex,
  instancedRecords,
  batchRoot
);
```

一句话总结：

```text
动作发生在隐藏控制模型上，显示发生在 InstancedMesh 上。
```
