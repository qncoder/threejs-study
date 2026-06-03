# ZF18000 前后立柱升降算法接入设计

## 目标

把当前项目里已经整理出的 C++ 液压缸伸缩算法，改写成 `Three.js` 能直接运行的 JS。第一版只驱动 `ZF18000.glb` 的前后立柱升降，用来验证节点、方向和冲程是否正确。

这版先完成两件事：

1. 提供一份可以粘进脚本编辑器执行的验证脚本。
2. 把验证通过的逻辑整理成 `src` 下的正式模块，并接到编辑器界面上。

## 范围

本次只处理前后立柱油缸：

- `frontcolumn_hydraulic_fixed_pos`
- `frontcolumn_hydraulic_fixed_end`
- `frontcolumn_hydraulic_slidingshaft1_pos`
- `frontcolumn_hydraulic_slidingshaft2_pos`
- `backcolumn_hydraulic_fixed_pos`
- `backcolumn_hydraulic_fixed_end`
- `backcolumn_hydraulic_slidingshaft1_pos`
- `backcolumn_hydraulic_slidingshaft2_pos`

这版不做顶梁、掩护梁、连杆的完整联动，也不做完整支架高度反解。等前后立柱伸缩跑通后，再继续接四连杆和高度反解。

## 算法思路

算法来自 C++ 里的液压缸伸缩逻辑，改写成 Three.js 后按下面方式执行：

1. 首次运行时记录各节点世界坐标，作为收回状态。
2. 用固定端到固定端末端的方向作为油缸伸缩方向。
3. 输入 `progress`，范围是 `0 ~ 1`。
4. 把 `progress` 换算成两段油缸的伸出量。
5. 第一段先伸出，第一段满冲程后第二段再伸出。
6. 收回时反过来，第二段先收，第二段收完后第一段再收。
7. 写入节点位置时，先算世界坐标，再转成父节点本地坐标。

核心公式：

```text
direction = normalize(fixedEndWorld - fixedWorld)
stage1 = clamp(totalStroke, 0, stage1Max)
stage2 = clamp(totalStroke - stage1Max, 0, stage2Max)

slidingShaft1World = slidingShaft1Init + direction * stage1
slidingShaft2World = slidingShaft2Init + direction * (stage1 + stage2)
```

这里的 `stage1Max` 和 `stage2Max` 会先沿用已有脚本里的默认值，后续可按模型真实尺寸调整。

## 脚本验证

先新增一份参考脚本：

```text
script/ZF18000ColumnHeight/run.js
```

脚本会直接运行在当前编辑器的脚本执行环境里，使用现有的：

- `node`
- `scene`
- `THREE`

脚本职责：

- 找到前后立柱节点。
- 如果缺节点，打印清晰的缺失信息。
- 记录初始姿态。
- 根据配置的目标高度进度移动前后两组立柱。
- 支持重复执行，不叠加错误状态。

这份脚本主要用来快速验证运动方向和冲程，不作为最终界面功能的唯一入口。

## 正式模块

验证脚本跑通后，新增模块：

```text
src/zf18000ColumnMotion.js
```

模块保持简单，主要导出这些函数：

- `createColumnMotionState(root)`：读取并保存前后立柱初始状态。
- `applyColumnHeight(root, state, progress)`：根据 `progress` 应用当前高度。
- `resetColumnHeight(root, state)`：恢复到初始姿态。

模块不引入 Vue，只处理 Three.js 对象和普通数据。这样符合当前项目“`App.vue` 负责协调，功能逻辑放在独立模块”的结构。

## 界面接入

在 `App.vue` 里加一个简单控制区：

- 支架高度滑条，范围 `0% ~ 100%`。
- 重置高度按钮。
- 状态提示，显示当前高度进度。

拖动滑条时调用 `applyColumnHeight(...)`。点击重置时调用 `resetColumnHeight(...)`。

如果模型没有加载，按钮和滑条禁用。如果缺少必要节点，状态栏提示缺失节点名称。

## 错误处理

需要处理这些情况：

- 模型未加载。
- 前后立柱节点缺失。
- 固定端和末端重合，无法算出方向。
- 输入进度不是有效数字。
- 节点父级不存在，无法把世界坐标转成本地坐标。

遇到这些情况时，不强行移动模型，而是返回错误信息给界面显示。

## 测试

新增测试文件：

```text
src/zf18000ColumnMotion.test.js
```

测试用 `Three.js` 的 `Object3D` 直接搭一个简化结构，不加载真实 GLB。

重点覆盖：

- 能找到完整的前后立柱节点。
- 缺节点时返回缺失列表。
- `progress = 0` 时保持初始姿态。
- `progress = 1` 时两段都到最大冲程。
- 中间进度时先伸第一段，再伸第二段。
- 重置后回到初始位置。

最后运行：

```bash
npm test
npm run build
```

## 后续扩展

这版跑通后，后续可以继续做：

- 顶梁跟随前后立柱升降。
- 连杆和掩护梁的四连杆解算。
- C++ 里的支架高度反解，输入目标高度后自动求冲程。
- 把不同机构的控制脚本整理成统一的脚本库。
