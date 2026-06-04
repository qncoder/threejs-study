# ZF18000 Column Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated route page for ZF18000 front/back column height debugging, with a reusable motion module and a paste-ready verification script.

**Architecture:** Keep the existing editor page as the root route, add a new debug route page for ZF18000 column height, and put the actual front/back column motion logic in `src/zf18000ColumnMotion.js`. The route page only handles model loading, viewer lifecycle, status text, and slider/reset controls.

**Tech Stack:** Vue 3, Vite, Vue Router, Three.js, Vitest.

---

### Task 1: Motion Module and Tests

**Files:**
- Create: `src/zf18000ColumnMotion.test.js`
- Create: `src/zf18000ColumnMotion.js`

- [ ] **Step 1: Write the failing tests**

Create `src/zf18000ColumnMotion.test.js` to cover:

```js
import { Object3D } from 'three';
import { describe, expect, test } from 'vitest';
import {
  applyColumnHeight,
  createColumnMotionState,
  resetColumnHeight,
} from './zf18000ColumnMotion.js';
```

Test cases:

```js
test('能读取完整的前后立柱节点', () => {});
test('缺少节点时返回缺失列表', () => {});
test('progress 为 0 时保持初始姿态', () => {});
test('progress 为 1 时两段都到最大冲程', () => {});
test('中间进度时先伸第一段再伸第二段', () => {});
test('reset 会回到初始姿态', () => {});
test('输入非法 progress 时返回错误且不移动模型', () => {});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/zf18000ColumnMotion.test.js`

Expected: fail because `src/zf18000ColumnMotion.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/zf18000ColumnMotion.js` with these exports:

```js
export function createColumnMotionState(root) {}
export function applyColumnHeight(root, state, progress) {}
export function resetColumnHeight(root, state) {}
```

Implementation requirements:

```js
// 1. 找前后立柱 8 个节点
// 2. 记录 fixed、fixed_end、slidingshaft1、slidingshaft2 的初始世界坐标
// 3. 用 fixed -> fixed_end 算方向
// 4. progress 映射到 stage1/stage2
// 5. 写回时先算世界坐标，再转父节点本地坐标
// 6. 任何错误都返回 { ok: false, error, missing? }，不要强行移动模型
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/zf18000ColumnMotion.test.js`

Expected: all `zf18000ColumnMotion` tests pass.

### Task 2: Verification Script

**Files:**
- Create: `script/ZF18000ColumnHeight/run.js`

- [ ] **Step 1: Add the paste-ready script**

Create a standalone script that uses:

```js
scene
node
THREE
```

The script should:

```js
// 1. 查找前后立柱节点
// 2. 首次运行记录初始姿态
// 3. 用固定 progress 计算两段冲程
// 4. 重复执行时始终基于初始姿态，不累计误差
// 5. 节点缺失或方向非法时输出清晰日志
```

### Task 3: Router and Debug Page

**Files:**
- Create: `src/router.js`
- Create: `src/RootApp.vue`
- Create: `src/pages/Zf18000ColumnDebugPage.vue`
- Modify: `src/main.js`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add Vue Router**

Install:

```bash
npm install vue-router@^4
```

- [ ] **Step 2: Add the router shell**

`src/router.js` should define:

```js
{ path: '/', component: App }
{ path: '/zf18000-column-height', component: Zf18000ColumnDebugPage }
```

`src/RootApp.vue` should render only:

```vue
<RouterView />
```

`src/main.js` should mount `RootApp` and `router`.

- [ ] **Step 3: Build the debug page**

`src/pages/Zf18000ColumnDebugPage.vue` should:

```js
// 1. 加载默认 ZF18000.glb，也支持手动换 GLB
// 2. 初始化 Three.js 场景、相机、灯光、网格、OrbitControls
// 3. 用 prepareLoadedModelStructure(root) 补齐 mesh 的 _pos Object3D
// 4. 用 createColumnMotionState(root) 建立立柱状态
// 5. 拖动滑条时调用 applyColumnHeight(...)
// 6. 点击重置时调用 resetColumnHeight(...)
// 7. 模型未加载或节点缺失时禁用控件并显示状态
```

### Task 4: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run the focused test**

Run: `npm test -- src/zf18000ColumnMotion.test.js`

Expected: focused tests pass.

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: build exits with code 0.

- [ ] **Step 4: Start the local dev server for route verification**

Run:

```bash
npm run dev
```

Expected: Vite starts successfully, and `/zf18000-column-height` can be opened for manual debugging.
