const fixed = node.getObjectByName('flap1_hydraulic_fixed_pos')
const sliding = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')

if (!fixed || !sliding) return

node.updateWorldMatrix(true, true)

const fixedPos = new THREE.Vector3()
const slidingPos = new THREE.Vector3()

// fixed.getWorldPosition(fixedPos)
sliding.getWorldPosition(slidingPos)

// fixed 指向 sliding
// fixed.lookAt(slidingPos)

// sliding 指向 fixed
sliding.lookAt(fixedPos)

node.updateWorldMatrix(true, true)



// 成功的lookAt
const rotate = ()=>{
setPosition(0, 0, 0);
setRotationDeg(90, 0, 0);
setScale(0.01, 0.01, 0.01);

// 也可以直接操作当前节点：
// node.position.y -= 10;
// node.rotation.z = deg(15);
const fixed = node.getObjectByName('flap1_hydraulic_fixed_pos')
const sliding = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')

if (!fixed || !sliding) return

node.updateWorldMatrix(true, true)

const fixedPos = new THREE.Vector3()
const slidingPos = new THREE.Vector3()

fixed.getWorldPosition(fixedPos)
sliding.getWorldPosition(slidingPos)

// 两端连线方向
const dir = new THREE.Vector3().subVectors(slidingPos, fixedPos)

// fixed 朝向 sliding
fixed.lookAt(slidingPos)

// sliding 也沿着 fixed -> sliding 的方向
const slidingTarget = slidingPos.clone().add(dir)
sliding.lookAt(slidingTarget)
const length = slidingPos.distanceTo(fixedPos);
console.log(length,'fixed')

}
