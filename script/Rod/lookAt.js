const backrod_fixed_pos = node.getObjectByName("backrod_fixed_pos")
const backrod_shield = node.getObjectByName("backrod_shield")
const frontrod_fixed_pos = node.getObjectByName("frontrod_fixed_pos")
const frontrod_shield = node.getObjectByName("frontrod_shield")

backrod_fixed_pos.lookAt(backrod_shield.getWorldPosition(new THREE.Vector3()))
frontrod_fixed_pos.lookAt(frontrod_shield.getWorldPosition(new THREE.Vector3()))
backrod_shield.lookAt(frontrod_shield.getWorldPosition(new THREE.Vector3()))
