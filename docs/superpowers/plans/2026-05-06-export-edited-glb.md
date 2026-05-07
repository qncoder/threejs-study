# Export Edited GLB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an “导出模型” button that downloads the current edited model as a new binary GLB file.

**Architecture:** Put GLB export behavior in `src/modelExport.js`, with `App.vue` only wiring the UI, status text, and browser download. The exporter wraps Three.js `GLTFExporter` in a Promise and always uses binary GLB output.

**Tech Stack:** Vue 3, Vite, Three.js, Vitest.

---

### Task 1: Export Module

**Files:**
- Create: `src/modelExport.test.js`
- Create: `src/modelExport.js`

- [ ] **Step 1: Write the failing tests**

Create `src/modelExport.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { createEditedGlbFileName, exportModelAsGlb } from './modelExport.js';

describe('modelExport', () => {
  it('根据原 GLB 文件名生成修改后模型文件名', () => {
    expect(createEditedGlbFileName('F309.glb')).toBe('F309-edited.glb');
  });

  it('没有有效文件名时使用默认导出文件名', () => {
    expect(createEditedGlbFileName('')).toBe('model-edited.glb');
  });

  it('用二进制 GLB 参数导出当前模型对象', async () => {
    const model = new Object3D();
    const binary = new ArrayBuffer(8);
    const exporter = {
      parse(input, onDone, onError, options) {
        expect(input).toBe(model);
        expect(options).toMatchObject({ binary: true });
        onDone(binary);
      },
    };

    await expect(exportModelAsGlb(model, exporter)).resolves.toBe(binary);
  });

  it('导出结果不是二进制数据时返回错误', async () => {
    const exporter = {
      parse(input, onDone) {
        onDone({ asset: { version: '2.0' } });
      },
    };

    await expect(exportModelAsGlb(new Object3D(), exporter)).rejects.toThrow('模型导出结果不是 GLB 二进制数据。');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/modelExport.test.js`

Expected: fail because `src/modelExport.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/modelExport.js`:

```js
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export function createEditedGlbFileName(fileName) {
  const normalized = String(fileName ?? '').trim();
  const baseName = normalized.replace(/\.glb$/i, '').trim() || 'model';
  return `${baseName}-edited.glb`;
}

export function exportModelAsGlb(model, exporter = new GLTFExporter()) {
  return new Promise((resolve, reject) => {
    if (!model) {
      reject(new Error('请先加载模型。'));
      return;
    }

    exporter.parse(
      model,
      (result) => {
        if (!(result instanceof ArrayBuffer)) {
          reject(new Error('模型导出结果不是 GLB 二进制数据。'));
          return;
        }
        resolve(result);
      },
      reject,
      { binary: true },
    );
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/modelExport.test.js`

Expected: all `modelExport` tests pass.

### Task 2: App Wiring

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Add imports**

Add:

```js
import { createEditedGlbFileName, exportModelAsGlb } from './modelExport.js';
```

- [ ] **Step 2: Add binary download helper and export handler**

Add near the existing JSON download helpers:

```js
function downloadBinary(payload, fileName, type) {
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportEditedModel() {
  stopMotionPlayback();
  if (!currentModel || !modelInfo.value) {
    status.value = '请先加载模型';
    return;
  }

  try {
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
```

- [ ] **Step 3: Add the button beside “新建 Object3D”**

Update the node title actions:

```vue
<button type="button" :disabled="!modelReady" @click="addPartObject3D">新建 Object3D</button>
<button type="button" :disabled="!modelReady" @click="exportEditedModel">导出模型</button>
<button type="button" :disabled="!modelReady" @click="refreshStructure">刷新</button>
```

### Task 3: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run the focused test**

Run: `npm test -- src/modelExport.test.js`

Expected: all focused tests pass.

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: build exits with code 0. Vite may print a large chunk warning from Three.js or GLB assets; that is acceptable if the build succeeds.
