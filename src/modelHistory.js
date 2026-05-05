import { isViewerCreatedObject3D } from './modelGrouping.js';
import { applyNodeTransform, readNodeTransform } from './modelTransform.js';

export function captureModelEditState(root) {
  const nodes = [];
  root.traverse((object) => {
    nodes.push({
      object,
      uuid: object.uuid,
      name: object.name,
      parent: object.parent,
      childIndex: object.parent ? object.parent.children.indexOf(object) : -1,
      transform: readNodeTransform(object),
    });
  });

  return { root, nodes };
}

export function restoreModelEditState(root, state) {
  if (!root || !state?.nodes?.length) return { restored: 0 };

  const snapshotObjects = new Set(state.nodes.map((item) => item.object));
  root.traverse((object) => {
    if (!snapshotObjects.has(object) && isViewerCreatedObject3D(object)) {
      object.parent?.remove(object);
    }
  });

  state.nodes.forEach((item) => {
    if (item.object === root) return;

    const parent = item.parent;
    if (!parent) return;

    if (item.object.parent !== parent) {
      item.object.parent?.remove(item.object);
      parent.add(item.object);
    }

    const currentIndex = parent.children.indexOf(item.object);
    if (currentIndex >= 0 && item.childIndex >= 0 && currentIndex !== item.childIndex) {
      parent.children.splice(currentIndex, 1);
      parent.children.splice(Math.min(item.childIndex, parent.children.length), 0, item.object);
    }
  });

  state.nodes.forEach((item) => {
    item.object.name = item.name;
    applyNodeTransform(item.object, item.transform);
  });

  root.updateWorldMatrix?.(true, true);
  return { restored: state.nodes.length };
}
