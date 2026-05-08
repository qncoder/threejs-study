# 项目结构说明

## 项目定位

这是一个基于 Vue 3、Vite 和 Three.js 的 GLB 模型结构查看器。它的核心目标是查看模型节点、调整节点层级、控制节点显隐、编辑节点脚本，并辅助分析 F309 模型里的机构部件关系。

## 目录结构

```text
src/
  App.vue                    页面主体、Three.js 场景生命周期和跨模块协调
  main.js                    Vue 应用入口
  styles.css                 全局布局和组件样式
  F309.glb                   默认加载的模型
  modelStructure.js          模型信息、节点列表、结构导出、姿态导出
  modelExport.js             当前编辑后模型的 GLB 导出
  modelTransform.js          节点位置、旋转、缩放的读取和写入
  modelGrouping.js           新建 Object3D、节点拖拽换父级、安全删除
  modelHistory.js            当前页面里的“返回上一步”编辑记录
  modelSessionState.js       当前浏览器会话里的模型编辑保存和恢复
  modelSelection.js          画布点击后决定哪个节点可被选中
  nodeContextMenu.js         节点右键菜单状态和菜单项
  nodeVisibility.js          节点隐藏/显示规则
  nodeFocus.js               聚焦节点时的相机目标计算
  nodeInfoSections.js        节点信息弹窗的分组数据
  nodeScriptControl.js       节点脚本执行、保存绑定、清除绑定
  nodeDropRules.js           节点列表拖拽投放规则
  nodeCollapse.js            节点列表折叠过滤
  mechanismRoles.js          F309 机构角色识别和说明
  mechanismMotion.js         内置动作演示
  poseMotion.js              姿态导入和姿态插值
  panelResize.js             左侧节点面板宽度限制
```

测试文件和源码放在同一目录，命名为 `*.test.js`。

## 页面职责

`App.vue` 仍然是主页面，但只负责把各模块串起来：

- 初始化 Three.js 场景、相机、灯光、渲染器、轨道控制器和变换控件。
- 加载默认 GLB 或用户选择的 GLB。
- 维护页面级状态，例如当前节点、节点列表、隐藏集合、弹窗状态、动作进度。
- 调用节点模块完成右键菜单、脚本弹窗、信息弹窗、显隐、聚焦和删除。

具体规则尽量放在独立 `.js` 文件中，避免继续把业务细节堆进模板。

## 节点交互

节点列表是主要入口：

- 左键节点名：选中节点。
- 右键节点行：打开菜单。
- 行内 `隐藏/显示`：切换当前节点可见性。
- 折叠按钮：只影响节点列表展开状态，不影响模型显示。
- 拖拽节点：把节点移动到 `Object3D` 或 `Mesh` 下。

右键菜单固定包含：

1. 编辑脚本
2. 查看信息
3. 删除
4. 聚焦

## 隐藏规则

隐藏规则由 `nodeVisibility.js` 管理：

- `Object3D` 隐藏时，影响它和所有子节点。
- `Mesh` 隐藏时，只影响自己。
- 父节点隐藏后，子节点即使没有单独隐藏，也视为不可见。
- 隐藏节点不能通过画布点击选中。
- 如果当前选中节点被隐藏，页面会清空选中状态，并移除选中框。

## 脚本规则

脚本能力集中在节点脚本弹窗里：

- 打开弹窗时，优先读取节点 `userData.controlScript`。
- 没有绑定脚本时，按当前节点变换生成默认脚本。
- `执行` 成功后会把编辑器里的内容保存到节点 `userData.controlScript`。
- `保存绑定` 写入 `userData.controlScript`。
- `清除绑定` 删除节点上的脚本绑定。

脚本里可用：

```js
node
setPosition(x, y, z)
setRotationDeg(x, y, z)
setScale(x, y, z)
deg(value)
```

## 会话保存

`modelSessionState.js` 负责把当前模型编辑状态保存到浏览器 `sessionStorage`。保存内容只包含可序列化的数据，不直接保存 Three.js 对象引用。

当前会保存：

- 节点父子关系，包括拖拽后放到 `Mesh` 或 `Object3D` 下的结果。
- 节点位置、旋转、缩放。
- 节点 `userData.controlScript` 脚本绑定。
- 节点隐藏/显示状态。
- 当前选中节点。
- 当前会话中新建的 Object3D。

加载 GLB 后，页面会先给原始节点写入内部稳定标识，再尝试按文件名读取会话数据并恢复。这样即使 Three.js 重新解析模型后生成了新的 `uuid`，也能尽量按原模型结构找到对应节点。

右侧“查看控制”里的 `清除会话` 只清掉当前模型文件名对应的本地会话保存，不会改动正在画布里的模型。

## 删除规则

删除能力由 `modelGrouping.js` 控制，策略比较保守：

- 只能删除当前会话里通过 `新建 Object3D` 创建的节点。
- 不能删除模型根节点。
- 不能删除原始 GLB 自带节点。
- 删除新建 Object3D 时，会先把它的子节点移回父级，避免误删原模型部件。

## 聚焦规则

聚焦能力由 `nodeFocus.js` 计算：

- 优先使用节点包围盒中心。
- 如果节点没有几何包围盒，则退回到节点世界坐标。
- 相机保持当前观察方向，只改变相机位置和控制器目标点。

## 测试策略

新增功能优先拆成独立模块，并给模块补单元测试。当前重点测试覆盖：

- 右键菜单项和状态
- 节点隐藏/显示规则
- 隐藏节点不可被选中
- 节点信息分组
- 节点聚焦目标计算
- 安全删除规则
- 脚本绑定、清除和执行
- 节点拖拽投放规则
- 当前浏览器会话里的模型编辑保存和恢复

运行完整验证：

```bash
npm test
npm run build
```

构建时如果出现 Vite 的大包体积提醒，主要来自 Three.js 和 GLB 模型资源，不影响当前功能运行。
