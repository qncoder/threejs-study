const frontcolumn_slidingshaft2_pos = node.getObjectByName("frontcolumn_hydraulic_slidingshaft2_pos")
const frontcolumn_fixed_pos = node.getObjectByName("frontcolumn_hydraulic_fixed_pos")
frontcolumn_slidingshaft2_pos.lookAt(frontcolumn_fixed_pos.getWorldPosition(new THREE.Vector3()))
frontcolumn_fixed_pos.lookAt(frontcolumn_slidingshaft2_pos.getWorldPosition(new THREE.Vector3()))

