const tailbeam_hydraulic_fixed_pos = node.getObjectByName('tailbeam_hydraulic_fixed_pos')
const tailbeam_hydraulic_slidingshaft_pos = node.getObjectByName('tailbeam_hydraulic_slidingshaft_pos')
const tailbeam_pos = node.getObjectByName('tailbeam_pos')
function customQuaternionLookAt(object, target) {
  const q = new THREE.Quaternion().setFromUnitVectors(
    object.getWorldDirection(new THREE.Vector3()), // 当前视线方向（世界系）
    target.clone().sub(object.getWorldPosition(new THREE.Vector3())).normalize() // 目标视线方向（世界系）
  )
  object.quaternion.premultiply(q)
}

customQuaternionLookAt(tailbeam_hydraulic_fixed_pos, tailbeam_hydraulic_slidingshaft_pos.getWorldPosition(new THREE.Vector3()))
customQuaternionLookAt(tailbeam_hydraulic_slidingshaft_pos, tailbeam_hydraulic_fixed_pos.getWorldPosition(new THREE.Vector3()))
customQuaternionLookAt(tailbeam_pos, tailbeam_hydraulic_slidingshaft_pos.getWorldPosition(new THREE.Vector3()))
