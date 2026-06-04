const backcolumn_slidingshaft2_pos = node.getObjectByName("backcolumn_hydraulic_slidingshaft2_pos")
const backcolumn_fixed_pos = node.getObjectByName("backcolumn_hydraulic_fixed_pos")


backcolumn_fixed_pos.lookAt(backcolumn_slidingshaft2_pos.getWorldPosition(new THREE.Vector3()))
backcolumn_slidingshaft2_pos.lookAt(backcolumn_fixed_pos.getWorldPosition(new THREE.Vector3()))
