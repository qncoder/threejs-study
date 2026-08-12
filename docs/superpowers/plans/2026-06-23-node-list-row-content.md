# 节点列表行内容优化 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化左侧节点列表每一行展示的信息——精简排版去重复、加状态/类型标记、显示变换数值。不动列表演能（虚拟化/分组折叠是另一条线），只改"一行里显示什么"。

**Background:** 现状一行是 `[▶/▼][类型图标][名称 + (类型文字 + 脚本数)][复制][👁]`。问题：①类型图标和类型文字重复；②`_pos` / `createdInViewer` / "有效隐藏" / lookAt 脚本这些项目核心概念在列表里看不出来；③变换数值（position/rotation/worldPos）`nodeRows` 里已算好但没展示。

**Architecture:** 遵循项目 thin App + fat module 模式。新增纯函数模块 `src/nodeRowMeta.js` 负责算行级标记和数值标签，App.vue 的 `collectRoleNodeRows` 调用 enrich，模板消费新字段，`src/styles.css` 加样式。不引入 Vue 依赖，纯函数可单测。

**Tech Stack:** Vue 3, Vite, Three.js, Vitest.

---

## 现状参考

数据链路（`src/App.vue`）：
```
collectRoleNodeRows(model)  // src/App.vue:2355
  = enrichNodeRowsWithRoles(collectNodeRows(model))   // modelStructure.js / mechanismRoles.js
      .map(row => ({ ...row, scriptCount }))          // 已有 scriptCount
nodeRows → visibleNodeRows(折叠) → filteredNodeRows(关键字) → nodePreviewRows(截断180)
```

每行 row 现有字段（`src/modelStructure.js:98`）：`uuid, name, displayName, path, type, depth, parentName, childCount, isMesh, geometryType, materialNames, position, rotation, rotationDeg, scale, worldPosition` + `mechanismRole` + `scriptCount`。

行模板：`src/App.vue:2513-2657`。样式：`src/styles.css:470-655`。

可复用的现成判断：
- `isViewerCreatedObject3D(object)` — `src/modelGrouping.js`（App 已 import，line 61）
- `isNodeEffectivelyHidden(node, hiddenNodeUuids, root)` — `src/nodeVisibility.js`（App 已 import，line 97）
- `getBoundNodeControlScripts(object)` — `src/nodeScriptControl.js`（用于判 lookAt）

---

### Task 1: 行级元数据模块和测试

**Files:**
- Create: `src/nodeRowMeta.test.js`
- Create: `src/nodeRowMeta.js`

- [ ] **Step 1: 写失败测试**

`src/nodeRowMeta.test.js`，用 `new Object3D()` / `new Mesh(...)` 造小场景，覆盖：

```js
import { describe, expect, it } from 'vitest'
import { Object3D, Mesh, BoxGeometry, MeshBasicMaterial } from 'three'
import { enrichNodeRowMeta } from './nodeRowMeta.js'

test('isPos：名称以 _pos 结尾标记为 true，否则 false')
test('createdInViewer：userData.createdInViewer=true 时标记为 true')
test('hasLookAtScript：controlScripts 里脚本名含 lookAt 或正文含 .lookAt( 时为 true')
test('effectiveHidden：父级在 hiddenUuids 里时子节点标记为有效隐藏')
test('worldPosLabel：worldPosition [1.234,5.678,9.012] 输出 "x 1.23 y 5.68 z 9.01"')
test('未传 hiddenUuids/root 时 effectiveHidden 默认 false 不报错')
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- src/nodeRowMeta.test.js`

Expected: 因 `src/nodeRowMeta.js` 不存在而失败。

- [ ] **Step 3: 写最小实现**

`src/nodeRowMeta.js` 导出纯函数（不 import Vue，不 import Three 除类型推断需要）：

```js
// 输入：row（nodeRows 的一项）、object（对应 Object3D，可空）、context={ hiddenUuids, root }
// 输出：追加在 row 上的标记对象，供 .map 合并
export function enrichNodeRowMeta(row, object, context = {}) {
  return {
    isPos: /_pos$/.test(row.name ?? ''),
    createdInViewer: Boolean(object?.userData?.createdInViewer === true),
    hasLookAtScript: detectLookAtScript(object),
    effectiveHidden: isNodeEffectivelyHidden(object, context.hiddenUuids, context.root),
    worldPosLabel: formatWorldPosLabel(row.worldPosition),
  }
}

// 内部：
// - detectLookAtScript：读 getBoundNodeControlScripts，名 /lookAt/i 或正文 /\.lookAt\(/ 命中
// - formatWorldPosLabel：[x,y,z] → "x 1.23 y 5.68 z 9.01"（两位小数）
// - isNodeEffectivelyHidden：复用 nodeVisibility.js 的同名函数
```

注意：`enrichNodeRowMeta` 接收 `object` 是为了读 `userData` 和走有效隐藏判断；App 侧需要能把 uuid 映射回 object（已有 `findObjectByUuid`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- src/nodeRowMeta.test.js`

Expected: 全部通过。

---

### Task 2: App.vue 接入元数据

**Files:**
- Modify: `src/App.vue`（`collectRoleNodeRows` + 模板 + 关联 helper）

- [ ] **Step 1: 在 collectRoleNodeRows 里 enrich**

`src/App.vue:2355` 的 `collectRoleNodeRows` 改为在 `.map` 里调用 `enrichNodeRowMeta`：

```js
function collectRoleNodeRows(model) {
  const scriptCounts = collectNodeScriptCounts(model)
  return enrichNodeRowsWithRoles(collectNodeRows(model)).map((row) => {
    const object = findObjectByUuid(row.uuid)
    const meta = enrichNodeRowMeta(row, object, {
      hiddenUuids: hiddenNodeUuids.value,
      root: currentModel,
    })
    return { ...row, scriptCount: scriptCounts.get(row.uuid) ?? 0, ...meta }
  })
}
```

说明：`findObjectByUuid` 已存在；`hiddenNodeUuids`/`currentModel` 在该函数作用域可见（闭包）。

- [ ] **Step 2: 模板去重复 + 加标记 + 加数值行**

`src/App.vue:2582-2619` 两处 `node-meta`（只读态和编辑态各一份）：

①去掉 `node-meta` 里的 `<span>{{ node.type }}</span>`（类型文字），只留脚本徽章。脚本徽章按 `hasLookAtScript` 加 class：

```html
<span
  v-if="node.scriptCount > 0"
  class="node-script-badge"
  :class="{ 'lookat-badge': node.hasLookAtScript }"
  :title="node.hasLookAtScript ? `${node.scriptCount} 个脚本（含 lookAt）` : `${node.scriptCount} 个绑定脚本`"
>
  {{ node.scriptCount }}
</span>
```

②在 `node-title` 后加状态标记和坐标行：

```html
<span class="node-title">
  {{ node.displayName }}
  <span v-if="node.isPos" class="node-flag flag-pos" title="_pos 朝向/位置 wrapper">pos</span>
  <span v-if="node.createdInViewer" class="node-flag flag-created" title="viewer 创建的节点">新建</span>
</span>
<span class="node-coord">{{ node.worldPosLabel }}</span>
```

（`node-coord` 放在名称下方第二行，默认显示精简 worldPos；选中节点的完整变换已在右侧"选中节点变换"区，不重复。）

- [ ] **Step 3: 有效隐藏的行级样式**

`src/App.vue:2518-2527` 的 `:class` 里加：

```js
'effective-hidden': node.effectiveHidden && !isNodeHidden(node),
```

注意：自己被隐藏的节点已有 `hidden-node`（删除线）；`effective-hidden` 只针对"父级隐藏导致不可见"的子节点，避免和删除线样式冲突。

---

### Task 3: 样式

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: 加标记和坐标样式**

在 `.node-script-badge` 区块附近（`src/styles.css:630` 附近）追加：

```css
.node-flag {
  display: inline-block;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 14px;
  vertical-align: middle;
}
.flag-pos { color: #1e40af; background: #dbeafe; }
.flag-created { color: #6b21a8; background: #f3e8ff; }

.node-coord {
  display: block;
  color: #a8a29e;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-list li.effective-hidden .node-title,
.node-list li.effective-hidden .node-coord {
  opacity: 0.5;
  font-style: italic;
}
.node-list li.effective-hidden .node-select {
  border-style: dashed;
}

.node-script-badge.lookat-badge {
  background: #ea580c;          /* 橙色，区别于普通绿色 */
  box-shadow: 0 0 0 2px rgb(234 88 12 / 14%);
}
.node-list li.active .node-script-badge.lookat-badge {
  background: #c2410c;
}
```

- [ ] **Step 2: 行高微调**

每行现在 `min-height: 34px`（`.collapse-toggle`/`.node-type-icon`/按钮都是）。加坐标行后单行变高，需把 `node-select` 改成允许两行：

```css
.node-list .node-select {
  /* 现有样式保留，去掉固定 min-height 限制或改 48px */
  min-height: 48px;
  flex-direction: column;       /* 让 title 和 coord 上下排 */
  align-items: stretch;
}
```

实际改动时先跑 dev 看效果再定数值，避免凭空调。

---

### Task 4: 验证

**Files:**
- No new files.

- [ ] **Step 1: 跑模块测试**

Run: `npm test -- src/nodeRowMeta.test.js`

Expected: 通过。

- [ ] **Step 2: 跑全量测试**

Run: `npm test`

Expected: 全绿（确认没碰坏 modelStructure / nodeVisibility / nodeScriptControl 相关用例）。

- [ ] **Step 3: 启动 dev 服务器人眼验证**

Run: `npm run dev`

Expected（对照 ZF18000.glb）：
- 节点行不再显示重复的类型文字（Mesh/Object3D）
- `backcolumn_hydraulic_fixed_pos` 等行名称后出现蓝色 `pos` 角标
- viewer 创建的节点名称后有紫色"新建"
- 折叠 `BackColumn` 后隐藏其父级——子节点行变灰斜体虚线（有效隐藏）
- 绑了 lookAt 的节点（BackColumn/FrontColumn/Rod/TopBeam/Shield/TopBeamDIR）脚本徽章变橙
- 每行名称下方有灰色 `x .. y .. z ..` 精简世界坐标

- [ ] **Step 4: 生产构建**

Run: `npm run build`

Expected: 退出码 0。

---

## 不做（YAGNI）

- ❌ 列表虚拟化 / 分组折叠（本轮只改行内容，性能/结构是另一条 plan）
- ❌ 在列表里显示材质/几何/三角面数（太细，右侧详情或 tooltip 已够）
- ❌ 显示完整位置/旋转/缩放三行（右侧"选中节点变换"区已做，列表只放精简 worldPos）
- ❌ 不动搜索/折叠的 bug（折叠后搜不到东西那个问题，属于"结构交互"，不在本 plan 范围）

## 风险

1. **行高变高导致可见节点数变少**：34px→约 48px，180 条截断区可视条数下降。可接受（73 节点远小于 180），大模型才痛，配合后续虚拟化 plan 解决。
2. **enrich 在 collectRoleNodeRows 每次重建时全量算**：小模型无所谓；若后续支持大模型，标记计算可移到纯函数层做增量。
3. **`enrichNodeRowMeta` 依赖 object 映射**：`findObjectByUuid` 是 O(n) 遍历，n 个节点调 n 次 = O(n²)。73 节点无感，大模型需改成 Map 索引。本 plan 不优化，记 TODO。
