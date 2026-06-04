const SCRIPT_LIBRARY_MODULES = import.meta.glob('../script/**/*.js', {
  query: '?raw',
  import: 'default',
});

export const SCRIPT_LIBRARY_ITEMS = createScriptLibraryItems(SCRIPT_LIBRARY_MODULES);

export function createScriptLibraryItems(modules) {
  return Object.entries(modules ?? {})
    .map(([path, load]) => ({
      id: path,
      path,
      name: createScriptLibraryName(path),
      fileName: createFileName(path),
      load,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

export async function loadScriptLibraryItemSource(item) {
  if (typeof item?.load !== 'function') return '';

  const source = await item.load();
  return String(source ?? '');
}

export function createScriptNameFromFileName(fileName) {
  const name = createFileName(fileName).replace(/\.js$/i, '').trim();
  return name || '上传脚本';
}

function createScriptLibraryName(path) {
  const parts = normalizePath(path).split('/').filter(Boolean);
  const scriptIndex = parts.lastIndexOf('script');
  const relativeParts = scriptIndex >= 0 ? parts.slice(scriptIndex + 1) : parts;
  const relativePath = relativeParts.join('/');

  return relativePath.replace(/\.js$/i, '') || createScriptNameFromFileName(path);
}

function createFileName(path) {
  const parts = normalizePath(path).split('/').filter(Boolean);
  return parts.at(-1) ?? '';
}

function normalizePath(path) {
  return String(path ?? '').replace(/\\/g, '/');
}
