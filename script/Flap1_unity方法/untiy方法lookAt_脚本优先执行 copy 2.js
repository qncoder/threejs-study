// 初始化 创建三个 位置相同的 OBject3D 方便 mesh放在里面 套用 旋转
// 先执行这个脚本

/**
 * 自定义四元数 LookAt 函数
 *
 * @param {THREE.Object3D} object - 需要旋转的物体
 * @param {THREE.Vector3} targetPosition - 目标看向的三维坐标 (世界坐标)
 * @param {THREE.Vector3} rotationAxis - 旋转参考轴 (相当于自定义的 Up 向量，用于规避奇点)
 * @param {number} [slerpAlpha=1.0] - 平滑插值系数 (0~1)，1为瞬间转过去，<1 可以实现平滑跟踪
 */
function customQuaternionLookAt(object, target) {
  // // 1. 获取物体的当前世界坐标
  // const position = new THREE.Vector3()
  // object.getWorldPosition(position)

  // // 2. 计算【前向向量 Forward (局部 Z 轴)】：从物体指向目标
  // const forward = new THREE.Vector3().subVectors(targetPosition, position).normalize()

  // // 3. 计算【右向向量 Right (局部 X 轴)】：参考轴(Up) 与 前向向量(Forward) 叉乘
  // const right = new THREE.Vector3().crossVectors(rotationAxis, forward).normalize()

  // // 奇点保护：如果目标恰好在参考轴方向上，叉乘结果会是零向量 (length = 0)
  // if (right.lengthSq() === 0) {
  //   // 遇到绝对极点时给一个微小的偏移，防止矩阵崩溃
  //   right.set(0, 0, 1).cross(forward).normalize()
  //   if (right.lengthSq() === 0) {
  //     right.set(1, 0, 0).cross(forward).normalize()
  //   }
  // }

  // // 4. 计算【真实的向上向量 True Up (局部 Y 轴)】：前向(Forward) 与 右向(Right) 叉乘
  // const trueUp = new THREE.Vector3().crossVectors(forward, right).normalize()

  // // 5. 使用这三个正交的基向量构建一个 4x4 旋转矩阵
  // const rotationMatrix = new THREE.Matrix4()
  // // makeBasis 依次传入 X轴, Y轴, Z轴 的方向向量
  // rotationMatrix.makeBasis(right, trueUp, forward)

  // // 6. 将矩阵直接转换为四元数（完全绕过欧拉角的万向节死锁计算）
  // const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix)

  // // 7. 处理父子层级 (如果物体在 Group 中，需要将世界四元数转换为局部四元数)
  // if (object.parent) {
  //   const parentMatrix = new THREE.Matrix4().extractRotation(object.parent.matrixWorld)
  //   const parentQuaternion = new THREE.Quaternion().setFromRotationMatrix(parentMatrix)
  //   // targetQuaternion = parentQuaternion^-1 * targetQuaternion
  //   targetQuaternion.premultiply(parentQuaternion.invert())
  // }

  // // 8. 应用四元数旋转 (支持 Slerp 球面线性插值，实现平滑追踪)
  // if (slerpAlpha >= 1.0) {
  //   object.quaternion.copy(targetQuaternion) // 直接应用
  // } else {
  //   object.quaternion.slerp(targetQuaternion, slerpAlpha) // 平滑过渡
  // }
  const q = new THREE.Quaternion().setFromUnitVectors(
    object.getWorldDirection(new THREE.Vector3()), // 当前视线方向（世界系）
    target.clone().sub(object.position).normalize() // 目标视线方向（世界系）
  )
  object.quaternion.premultiply(q)
}

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
// customQuaternionLookAt(EObject,DObject.getWorldPosition(new THREE.Vector3()))
