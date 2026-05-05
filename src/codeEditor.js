export function createCodeLineNumbers(code) {
  const lineCount = Math.max(1, String(code ?? '').split('\n').length);
  return Array.from({ length: lineCount }, (_, index) => index + 1);
}

export function createCodeStats(code) {
  const text = String(code ?? '');
  return {
    lines: createCodeLineNumbers(text).length,
    chars: text.length,
  };
}

export function insertTextAtSelection(value, selectionStart, selectionEnd, insertedText) {
  const text = String(value ?? '');
  const start = clampIndex(selectionStart, text.length);
  const end = clampIndex(selectionEnd, text.length);
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const nextValue = `${text.slice(0, from)}${insertedText}${text.slice(to)}`;
  const nextSelection = from + String(insertedText).length;

  return {
    value: nextValue,
    selectionStart: nextSelection,
    selectionEnd: nextSelection,
  };
}

export function isRunShortcut(event) {
  return event?.key === 'Enter' && (event.ctrlKey || event.metaKey);
}

function clampIndex(value, length) {
  const number = Number(value);
  if (!Number.isFinite(number)) return length;

  return Math.min(Math.max(number, 0), length);
}
