// 初始化 创建三个 位置相同的 OBject3D 方便 mesh放在里面 套用 旋转
// 先执行这个脚本


const AObject = node.getObjectByName('flap1_driving_shaft_pos')
const BObject = node.getObjectByName('flap1_hydraulic_fixed_pos')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
const DObject = node.getObjectByName('flap1_output_shaft_pos')
CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
BObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
AObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
DObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
