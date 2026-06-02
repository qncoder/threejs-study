import { initializeMeshObject3Ds } from './modelGrouping.js'
import { ensureModelSessionNodeKeys } from './modelSessionState.js'

function createEmptySessionResult() {
  return {
    restored: 0,
    created: 0,
    selectedNodeUuid: '',
    hiddenNodeUuids: new Set(),
  }
}

export function prepareLoadedModelStructure(root, restoreSessionState = createEmptySessionResult) {
  if (!root) {
    return {
      sessionResult: createEmptySessionResult(),
      meshObjectResult: { created: 0, skipped: 0 },
    }
  }

  root.updateWorldMatrix?.(true, true)
  ensureModelSessionNodeKeys(root)
  const sessionResult = restoreSessionState() ?? createEmptySessionResult()
  const meshObjectResult = initializeMeshObject3Ds(root)
  ensureModelSessionNodeKeys(root)
  root.updateWorldMatrix?.(true, true)

  return {
    sessionResult,
    meshObjectResult,
  }
}
