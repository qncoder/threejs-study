const pointA = node.getObjectByName('flap1_driving_shaft')
const pointB = node.getObjectByName('flap1_hydraulic_fixed')
const pointC = node.getObjectByName('flap1_hydraulic_slidingshaft')
const A = pointA.getWorldPosition(new THREE.Vector3());
const B = pointB.getWorldPosition(new THREE.Vector3());
const C = pointC.getWorldPosition(new THREE.Vector3());

const AB = new THREE.Vector3().subVectors(B, A);
const AC = new THREE.Vector3().subVectors(C, A);

const BA = new THREE.Vector3().subVectors(A, B);
const BC = new THREE.Vector3().subVectors(C, B);

const CA = new THREE.Vector3().subVectors(A, C);
const CB = new THREE.Vector3().subVectors(B, C);

const angleA = THREE.MathUtils.radToDeg(AB.angleTo(AC));
const angleB = THREE.MathUtils.radToDeg(BA.angleTo(BC));
const angleC = THREE.MathUtils.radToDeg(CA.angleTo(CB));

console.log(angleA, angleB, angleC);
