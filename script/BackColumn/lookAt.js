// // BackColumn lookAt —— 一次性给 6 个 Object3D 设定朝向
// //
// // 工作流（沿用 Flap1 / FlexBeamStroke 的约定）：
// //   1. 先执行这个脚本：给所有 _pos / _end 设定朝向
// //   2. 在节点列表把 mesh + _end 拖入对应的 _pos（让 _pos 成为父节点）
// //   3. 后续执行 run.js 时柱体平移即可，朝向已经由 _pos 决定，无需再 lookAt
// //
// // 朝向约定（"邻居互看 + 子段看回母段顶部"）：
// //   A_pos (fixed 底) ──→ A_end (fixed 顶)       固定缸沿自身长度向上
// //   A_end           ──→ A_pos                  对称回望
// //   B_pos (rod1 顶) ──→ A_end                   "我从固定缸的顶伸出来"
// //   B_end (rod1 底) ──→ B_pos                  对称回望
// //   C_pos (rod2 顶) ──→ B_pos                   "我从 rod1 的顶伸出来"
// //   C_end (rod2 底) ──→ C_pos                  对称回望

// const A_pos = node.getObjectByName('backcolumn_hydraulic_fixed_pos')
// const A_end = node.getObjectByName('backcolumn_hydraulic_fixed_end')
// const B_pos = node.getObjectByName('backcolumn_hydraulic_slidingshaft1_pos')
// const B_end = node.getObjectByName('backcolumn_hydraulic_slidingshaft1_end')
// const C_pos = node.getObjectByName('backcolumn_hydraulic_slidingshaft2_pos')
// const C_end = node.getObjectByName('backcolumn_hydraulic_slidingshaft2_end')

// if (!A_pos || !A_end || !B_pos || !B_end || !C_pos || !C_end) {
//   console.warn('BackColumn 缺少必要节点', { A_pos, A_end, B_pos, B_end, C_pos, C_end })
//   return
// }

// function worldPos(obj) {
//   return obj.getWorldPosition(new THREE.Vector3())
// }

// A_pos.lookAt(worldPos(A_end))
// A_end.lookAt(worldPos(A_pos))
// B_pos.lookAt(worldPos(A_end))
// B_end.lookAt(worldPos(B_pos))
// C_pos.lookAt(worldPos(B_pos))
// C_end.lookAt(worldPos(C_pos))

// node.updateWorldMatrix(true, true)

// console.log('BackColumn lookAt 完成。现在去节点列表把 6 个 mesh + _end 拖入对应的 _pos：')
// console.log('  backcolumn_hydraulic_fixed             → backcolumn_hydraulic_fixed_pos')
// console.log('  backcolumn_hydraulic_fixed_end         → backcolumn_hydraulic_fixed_pos')
// console.log('  backcolumn_hydraulic_slidingshaft1     → backcolumn_hydraulic_slidingshaft1_pos')
// console.log('  backcolumn_hydraulic_slidingshaft1_end → backcolumn_hydraulic_slidingshaft1_pos')
// console.log('  backcolumn_hydraulic_slidingshaft2     → backcolumn_hydraulic_slidingshaft2_pos')
// console.log('  backcolumn_hydraulic_slidingshaft2_end → backcolumn_hydraulic_slidingshaft2_pos')
// console.log('完事后选中 BackColumn，把 run.js 粘到脚本对话框驱动伸缩。')

const backcolumn_slidingshaft2_pos = node.getObjectByName("backcolumn_hydraulic_slidingshaft2_pos")
const backcolumn_slidingshaft1_pos = node.getObjectByName("backcolumn_hydraulic_slidingshaft1_pos")
const backcolumn_fixed_pos = node.getObjectByName("backcolumn_hydraulic_fixed_pos")


backcolumn_fixed_pos.lookAt(backcolumn_slidingshaft2_pos.getWorldPosition(new THREE.Vector3()))
backcolumn_slidingshaft1_pos.lookAt(backcolumn_slidingshaft2_pos.getWorldPosition(new THREE.Vector3()))
backcolumn_slidingshaft2_pos.lookAt(backcolumn_fixed_pos.getWorldPosition(new THREE.Vector3()))
