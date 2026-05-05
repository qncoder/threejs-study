export function getNodeCopyName(node) {
  const displayName = String(node?.displayName ?? '').trim();
  if (displayName) return displayName;

  return String(node?.name ?? '').trim();
}

export async function copyNodeNameToClipboard(node, clipboard) {
  const text = getNodeCopyName(node);
  if (!text) {
    return { ok: false, text: '', error: '节点名称为空，无法复制' };
  }
  if (!clipboard?.writeText) {
    return { ok: false, text, error: '当前浏览器不支持复制到剪贴板' };
  }

  try {
    await clipboard.writeText(text);
    return { ok: true, text, error: '' };
  } catch (error) {
    return {
      ok: false,
      text,
      error: error?.message ? `复制失败：${error.message}` : '复制失败',
    };
  }
}
