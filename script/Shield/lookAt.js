const shield_pos = node.getObjectByName("shield_pos")
const frontcolumn_hydraulic_slidingshaft2_pos = node.parent.parent.getObjectByName("frontcolumn_hydraulic_slidingshaft2_pos")
shield_pos.lookAt(frontcolumn_hydraulic_slidingshaft2_pos.getWorldPosition(new THREE.Vector3()))
