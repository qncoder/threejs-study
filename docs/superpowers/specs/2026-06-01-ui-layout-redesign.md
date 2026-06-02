# UI 布局改版计划书

> 日期：2026-06-01
> 状态：方案设计

---

## 1. 背景和目标

### 1.1 项目定位

本项目是一个基于 Vue 3 + Vite + Three.js 的 GLB 模型脚本编辑器。核心使用场景是：

1. 加载 GLB 机械模型（液压支架、翻板机构等）
2. 在节点树中找到目标部件
3. 给部件编写 JavaScript 控制脚本（设置位置、旋转、联动动画）
4. 实时在 3D 视口中观察脚本执行效果
5. 反复调试，直到机构动作正确

**核心循环**：选节点 → 写脚本 → 看效果 → 改脚本 → 看效果

### 1.2 当前痛点

| # | 痛点 | 影响 |
|---|------|------|
| 1 | 脚本编辑器是浮动弹窗，遮挡 3D 视口 | 写代码时看不到模型，要反复拖动弹窗或关闭再打开 |
| 2 | 左侧节点面板太宽（320px），头部塞了 5 个按钮 | 挤占 3D 视口空间，按钮功能优先级不分 |
| 3 | 右侧面板功能散乱 | 文件选择器、变换读数、查看控制、模型信息混在一起 |
| 4 | 画布工具栏按钮平铺 | 变换模式、相机、撤销、重置没有视觉分组 |
| 5 | 选中节点后无法快速跳到脚本编辑 | 需要右键 → 编辑脚本，多一步操作 |

### 1.3 改版目标

- 让"选节点 → 写脚本 → 看效果"的循环尽量快
- 脚本编辑器和 3D 视口同时可见，不互相遮挡
- 按钮和控件按使用频率分层，高频操作一键可达
- 参考主流 3D 编辑器（Three.js Editor、Godot、PlayCanvas、Unity）的布局经验

---

## 2. 竞品调研

### 2.1 调研对象

| 软件 | 类型 | 借鉴点 |
|------|------|--------|
| Three.js Editor | 开源 Web 3D 编辑器 | 左树 + 右属性 + 中视口 的三栏布局；点击 3D → 树同步高亮 |
| Godot Engine | 开源游戏引擎 | 节点树带类型图标 + 搜索过滤；脚本编辑器与视口分屏而非弹窗 |
| BabylonJS Playground | 开源 Web 3D 沙箱 | 左代码 / 右视口 的固定分栏，修改即执行 |
| PlayCanvas Editor | 商业 Web 3D 引擎 | 上工具栏 / 左树 / 右属性 / 底资源 的四区布局 |
| Unity | 商业游戏引擎 | Inspector 选中即展示脚本组件；Timeline 多轨道关键帧 |
| Rive | 商业动画工具 | 状态机 + 时间线分层，适合"机构姿态切换"场景 |
| Spline.design | 商业 Web 3D 工具 | 上下文感知工具栏，选中什么显示什么 |
| Blender | 开源 3D 建模 | Scripting 工作区：文本编辑器底部 + 视口顶部 + 控制台，可调大小 |

### 2.2 关键结论

1. **脚本面板应该是停靠的分栏，不是浮动弹窗**。Blender、Godot、PlayCanvas、BabylonJS Playground 无一例外都把代码编辑器作为固定面板嵌入布局。
2. **底部停靠是最适合本项目的位置**。因为左栏已有节点树、右栏放属性，代码编辑器放底部可以全宽展开，同时保留 3D 视口的高度。Blender Scripting 工作区和 Unity Console 都用底部。
3. **节点树应该更紧凑**。Godot / Three.js Editor 的节点树都只有 ~200px 宽，用图标区分类型，主操作按钮放在工具栏而不是节点面板头部。

---

## 3. 目标布局

### 3.1 布局示意

```
┌──────────┬──────────────────────────┬───────────┐
│ 节点树    │       3D 视口             │  属性面板  │
│ ~240px   │       自适应              │  ~280px   │
│          │                          │           │
│ [搜索框]  │  ┌──────────────────┐    │ 选中节点   │
│ [节点列表] │  │  工具栏（分组）   │    │ 变换数值   │
│  带图标   │  └──────────────────┘    │ [编辑脚本] │
│  可折叠   │                          │ 查看控制   │
│          │                          │ 模型信息   │
├──────────┴──────────┬───────────────┴───────────┤
│ ═ 拖拽调节高度 ═══════                            │
├───────────────────────────────────────────────────┤
│  底部面板（脚本编辑器）~300px 高，可收起             │
│                                                   │
│  [节点名: xxx] [插入: 位置 旋转 缩放 角度]           │
│  ┌─────────────────────────────────────────────┐  │
│  │  Monaco Editor (JavaScript)                 │  │
│  │                                             │  │
│  └─────────────────────────────────────────────┘  │
│  [执行] [保存绑定] [清除绑定] [隐藏三角形] [重置画布]  │
│  状态消息行                                        │
└───────────────────────────────────────────────────┘
```

### 3.2 CSS Grid 结构

```css
.app-shell {
  display: grid;
  grid-template-columns: var(--structure-panel-width, 240px) 6px 1fr 280px;
  grid-template-rows: 1fr auto var(--bottom-panel-height, 300px);
  height: 100vh;
  overflow: hidden;
}

/* 上半部分四栏占第 1 行 */
.structure-panel { grid-column: 1; grid-row: 1; }
.panel-resizer   { grid-column: 2; grid-row: 1; }
.viewer-panel    { grid-column: 3; grid-row: 1; }
.side-panel      { grid-column: 4; grid-row: 1; }

/* 底部分隔线占第 2 行，全宽 */
.bottom-resizer  { grid-column: 1 / -1; grid-row: 2; }

/* 底部面板占第 3 行，全宽 */
.bottom-panel    { grid-column: 1 / -1; grid-row: 3; }
```

当底部面板收起时：

```css
.app-shell.bottom-collapsed {
  grid-template-rows: 1fr auto 0;
}
```

---

## 4. 分区改动详述

### 4.1 底部面板（新增，替代浮动弹窗）

**功能不变**，只是承载位置从浮动弹窗变为停靠面板。

#### 内部结构

```html
<section class="bottom-panel">
  <!-- 头部工具栏 -->
  <header class="bottom-panel-header">
    <div class="bottom-panel-node-info">
      <!-- 当前脚本绑定的节点名 -->
      <span>节点脚本：{{ scriptDialog.nodeTitle }}</span>
      <span class="bottom-panel-path">{{ scriptDialog.nodePath }}</span>
    </div>
    <div class="bottom-panel-actions-left">
      <!-- 代码片段快捷插入 -->
      <span>插入</span>
      <button>位置</button>
      <button>旋转</button>
      <button>缩放</button>
      <button>角度</button>
      <em>{{ lines }} 行 / {{ chars }} 字符</em>
    </div>
    <div class="bottom-panel-actions-right">
      <button>执行</button>
      <button>保存绑定</button>
      <button>清除绑定</button>
      <button>隐藏三角形</button>
      <button>重置画布</button>
      <button @click="toggleBottomPanel">收起 ▼</button>
    </div>
  </header>

  <!-- Monaco 编辑器 -->
  <div class="bottom-panel-editor">
    <ScriptCodeEditor ... />
  </div>

  <!-- 状态消息 -->
  <p class="bottom-panel-message">{{ scriptDialog.message }}</p>
</section>
```

#### 状态变更

`scriptDialog` ref 的 shape 修改：

```diff
  {
    open: false,        // 改语义：true = 底部面板展开, false = 底部面板收起
    nodeUuid: '',
    nodeTitle: '',
    nodeType: '',
    nodePath: '',
    script: '',
    message: '',
    messageType: 'hint',
-   x: 72,             // 删除：不再需要浮动位置
-   y: 72,             // 删除
  }
```

新增 ref：

```javascript
const bottomPanelHeight = ref(300);   // 底部面板高度，px
const isBottomPanelCollapsed = ref(true);  // 是否收起
```

#### 需要删除的代码

| 文件 | 内容 | 原因 |
|------|------|------|
| App.vue | `scriptDialogDrag` ref | 不再需要拖拽 |
| App.vue | `startScriptDialogDrag()` | 不再需要拖拽 |
| App.vue | `handleScriptDialogDragMove()` | 不再需要拖拽 |
| App.vue | `stopScriptDialogDrag()` | 不再需要拖拽 |
| App.vue | 模板中 `.floating-script-modal` 整个 `<section>` | 用底部面板替代 |
| App.vue | `onBeforeUnmount` 中的 `window.removeEventListener('pointermove', handleScriptDialogDragMove)` 和对应 `pointerup` | 随拖拽删除 |
| styles.css | `.floating-script-modal` 样式 | 不再使用 |
| styles.css | `.draggable-modal-header` 样式 | 不再使用 |
| dialogDrag.js | `startDialogDrag`、`moveDialogByPointer` 相关调用 | 底部面板不需要拖拽位置计算 |

注意：`dialogDrag.js` 本身不一定要删文件，因为信息弹窗（infoDialog）未来也可能用到拖拽。但脚本弹窗对它的引用全部移除。

#### 需要修改的代码

| 函数 | 当前行为 | 改为 |
|------|---------|------|
| `openScriptDialog(uuid)` | 计算浮动位置、设置 x/y | 设置 `isBottomPanelCollapsed = false`，调用 `updateScriptDialogForNode(uuid)` |
| `closeScriptDialog()` | 关闭弹窗 | 设置 `isBottomPanelCollapsed = true` |
| `updateScriptDialogForNode(uuid, position)` | 接收 position 参数 | 移除 position 参数 |

#### 需要新增的代码

| 项目 | 说明 |
|------|------|
| `toggleBottomPanel()` | 切换 `isBottomPanelCollapsed` |
| `startBottomPanelResize(event)` / `handleBottomPanelResize(event)` / `stopBottomPanelResize()` | 底部面板高度拖拽调节，类似现有的 `startStructureResize` 逻辑 |
| `clampBottomPanelHeight(height)` | 限制在 120px ~ 60vh 范围，可放入 `panelResize.js` |
| CSS 变量 `--bottom-panel-height` | 由 `bottomPanelHeight` ref 驱动 |
| `.bottom-panel` 及内部样式 | 见下方 4.1.1 |

#### 4.1.1 底部面板关键 CSS

```css
.bottom-panel {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  flex-direction: column;
  border-top: 1px solid #d6d1c6;
  background: #1c1917;
  color: #e7e5e4;
  overflow: hidden;
}

.bottom-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid #292524;
  background: #292524;
  flex-shrink: 0;
}

.bottom-panel-editor {
  flex: 1;
  min-height: 0;  /* 让 Monaco 正确填充 */
}

.bottom-resizer {
  grid-column: 1 / -1;
  grid-row: 2;
  height: 6px;
  cursor: row-resize;
  background: #292524;
}

.bottom-resizer:hover {
  background: #1f8a70;
}

/* 收起状态 */
.app-shell.bottom-collapsed .bottom-panel {
  display: none;
}

.app-shell.bottom-collapsed .bottom-resizer {
  display: none;
}
```

### 4.2 左侧节点面板（精简）

#### 宽度

默认宽度从 320px 缩小到 **240px**。`--structure-panel-width` 的初始值改为 240。

#### 头部按钮精简

**保留在面板头部的**：
- 搜索框（保持）
- "刷新" 按钮（保持）
- "全部隐藏/全部展示" 按钮（保持）

**移出到画布工具栏或其他位置的**：
- "新建 Object3D" → 移到画布工具栏（或右键菜单已有，可从头部移除）
- "初始化 Object" → 移到画布工具栏
- "导出模型" → 移到右侧面板（文件操作区）

#### 节点类型图标

在每个节点行的折叠按钮和名称之间，加一个小 SVG 图标：

| 节点类型 | 图标 | 说明 |
|---------|------|------|
| Object3D | 📁 空心文件夹 | 容器节点 |
| Mesh | 🔷 立方体 | 网格 |
| Group | 📁 实心文件夹 | 分组 |
| Bone | 🦴 骨骼 | 骨骼（如有） |
| 其他 | ○ 圆圈 | 未知类型 |

实现方式：在 `<li>` 模板里，折叠按钮之后加一个 `<span class="node-type-icon">` ，内容根据 `node.type` 选择对应的内联 SVG path。

### 4.3 右侧属性面板（重组）

#### 新结构（从上到下）

1. **文件操作**（精简）
   - 文件选择器按钮（保持）
   - 状态行（保持）
   - "导出模型" 按钮（从左面板移过来）
   - "清除会话" 按钮

2. **选中节点变换**（保持，增强）
   - 变换读数 position / rotation / scale — 保持
   - 增加一个"编辑脚本"按钮：点击后展开底部面板并加载该节点脚本
   - 增加一个"聚焦"按钮

3. **查看控制**（精简）
   - "重置视角" 按钮（保持）
   - 其他按钮（线框、网格、透明、模型可见性）**移到画布工具栏**

4. **模型信息**（保持，默认折叠）

### 4.4 画布工具栏（重新分组）

当前 7 个按钮平铺。改为分组，用竖线分隔符视觉分组：

```
[位置] [旋转] [缩放]  |  [线框] [网格] [透明] [显隐]  |  [相机模式]  |  [撤销] [局部重置] [重置]
 ─── 变换模式 ───     ─── 显示控制（新增）───      ─ 相机 ─     ──── 操作 ────
```

"新建 Object3D" 和 "初始化 Object" 也可以在工具栏末尾加一个 `[+]` 下拉按钮，点开后选择。

### 4.5 移动端适配（max-width: 980px）

底部面板在移动端堆叠在最下方，高度自适应：

```css
@media (max-width: 980px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto minmax(40vh, 1fr) auto auto;
  }
  /* 节点树 → 视口 → 底部面板 → 属性面板 垂直排列 */
}
```

---

## 5. 受影响文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/styles.css` | 修改 | 新 Grid 布局、底部面板样式、工具栏分组、左面板瘦身、移除浮动弹窗样式 |
| `src/App.vue` (template) | 修改 | 移除浮动脚本弹窗 `<section>`，新增底部面板 `<section>`，左面板按钮精简，右面板重组，工具栏增加显示控制按钮 |
| `src/App.vue` (script) | 修改 | 新增 `bottomPanelHeight`/`isBottomPanelCollapsed` ref，修改 `openScriptDialog`/`closeScriptDialog`，新增底部面板 resize 函数，删除拖拽相关函数和事件监听 |
| `src/panelResize.js` | 修改 | 新增 `clampBottomPanelHeight(height, min, max)` 函数 |
| `src/nodeScriptControl.js` | 不变 | 脚本执行逻辑完全不变 |
| `src/ScriptCodeEditor.vue` | 不变 | Monaco 组件不变，`automaticLayout: true` 已有 |
| `src/dialogDrag.js` | 可能修改 | 移除脚本弹窗相关调用（文件保留，infoDialog 可能仍需要） |

---

## 6. 不变项

以下模块和行为**不在本次改动范围内**：

- `nodeScriptControl.js` — 脚本执行、绑定、清除逻辑
- `ScriptCodeEditor.vue` — Monaco 编辑器组件
- `modelSessionState.js` — 会话保存/恢复
- `modelGrouping.js` — 节点创建/删除
- `nodeVisibility.js` / `nodeFocus.js` / `nodeDropRules.js` — 隐藏/聚焦/拖拽规则
- `mechanismMotion.js` / `poseMotion.js` — 动作演示和姿态插值
- 右键菜单功能（菜单仍然可以打开脚本编辑，只是结果是展开底部面板而非打开弹窗）
- 信息弹窗（`infoDialog`）保持浮动弹窗不变

---

## 7. 实施步骤建议

| 步骤 | 内容 | 预估工作量 |
|------|------|-----------|
| 1 | 修改 CSS Grid 布局，添加底部面板和分隔线的 grid 区域 | 小 |
| 2 | 在 App.vue 模板中添加底部面板 `<section>`，把浮动弹窗的内容原样搬入 | 中 |
| 3 | 新增 `bottomPanelHeight` / `isBottomPanelCollapsed` ref 和相关函数 | 小 |
| 4 | 修改 `openScriptDialog` / `closeScriptDialog` 逻辑 | 小 |
| 5 | 实现底部面板高度拖拽调节（复用左面板 resize 的模式） | 小 |
| 6 | 删除浮动弹窗模板、样式和拖拽代码 | 小 |
| 7 | 精简左面板：移出按钮、缩小默认宽度 | 小 |
| 8 | 重组右面板：增加"编辑脚本"按钮，移出查看控制按钮 | 小 |
| 9 | 重组画布工具栏：增加显示控制分组 | 小 |
| 10 | 添加节点类型图标 | 小 |
| 11 | 移动端适配调整 | 小 |
| 12 | 全流程手动测试 | 中 |

---

## 8. 验收标准

- [ ] 脚本编辑器在底部面板中，和 3D 视口同时可见
- [ ] 底部面板可拖拽调节高度（120px ~ 60vh）
- [ ] 底部面板可收起/展开
- [ ] 右键菜单"编辑脚本"展开底部面板并加载节点脚本
- [ ] 右侧面板"编辑脚本"按钮展开底部面板
- [ ] 所有原有脚本功能正常：执行、保存绑定、清除绑定、片段插入、Ctrl+Enter
- [ ] 左面板默认 240px，头部只保留搜索、刷新、全部隐藏
- [ ] 节点行显示类型图标
- [ ] 画布工具栏增加显示控制按钮（线框、网格、透明、模型显隐）
- [ ] 信息弹窗不受影响
- [ ] 移动端布局正常堆叠
- [ ] `npm test` 全部通过
- [ ] `npm run build` 构建成功

---

## 9. 未来扩展（不在本次范围）

以下功能不在本次改版范围内，但新布局为它们预留了空间：

1. **底部面板多标签页**：脚本 / 控制台 / 时间线，用标签切换
2. **3D 点选 → 插入节点引用**：在脚本编辑器中"拾取模式"，点击 3D 部件插入 `scene.getObjectByName('...')`
3. **多轨道时间线**：替代当前 slider，每个被驱动节点一个轨道，菱形标记关键帧
4. **状态机预设**：定义"收缩/展开/中间位"等预设姿态，一键切换
5. **快捷键系统**：W/E/R 切换变换模式、F 聚焦、H 隐藏、`` ` `` 收起底部面板
