export const SCRIPT_DEBUG_HELPER_NAMES = [
  'TailBeam_ABC_Debug',
  'TailBeam_Motion_Debug',
];

export function removeScriptDebugHelpers(scene) {
  if (!scene) return 0;

  const helperNames = new Set(SCRIPT_DEBUG_HELPER_NAMES);
  const helpers = [];

  scene.traverse((object) => {
    if (helperNames.has(object.name)) {
      helpers.push(object);
    }
  });

  helpers.forEach((helper) => {
    disposeObjectTree(helper);
    helper.parent?.remove(helper);
  });

  return helpers.length;
}

function disposeObjectTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();

    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material?.dispose?.());
    } else {
      object.material?.dispose?.();
    }
  });
}
