const nodes = scene.getObjectByName('frontcolumn_hydraulic_slidingshaft1_pos');

// 定义局部轴向（根据你的模型实际朝向，可能是 Z 或 X）
const LOCAL_AXIS = new THREE.Vector3(0, 0, 1);

const worldAxis = LOCAL_AXIS.clone().applyQuaternion(nodes.quaternion);

nodes.position.addScaledVector(worldAxis, -0.1);

nodes.updateWorldMatrix(true, false);


