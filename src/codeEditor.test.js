import { describe, expect, it } from 'vitest';
import {
  createCodeLineNumbers,
  createCodeStats,
  insertTextAtSelection,
  isRunShortcut,
} from './codeEditor.js';

describe('codeEditor', () => {
  it('按代码内容生成行号，空内容也保留第一行', () => {
    expect(createCodeLineNumbers('')).toEqual([1]);
    expect(createCodeLineNumbers('a\nb\nc')).toEqual([1, 2, 3]);
  });

  it('在光标位置插入文本并返回新的选区', () => {
    const result = insertTextAtSelection('setPosition();', 14, 14, '\nsetScale(1, 1, 1);');

    expect(result).toEqual({
      value: 'setPosition();\nsetScale(1, 1, 1);',
      selectionStart: 33,
      selectionEnd: 33,
    });
  });

  it('替换选区内容', () => {
    const result = insertTextAtSelection('abcXYZdef', 3, 6, '123');

    expect(result).toEqual({
      value: 'abc123def',
      selectionStart: 6,
      selectionEnd: 6,
    });
  });

  it('统计行数和字符数', () => {
    expect(createCodeStats('a\nbc')).toEqual({ lines: 2, chars: 4 });
  });

  it('识别 Ctrl 或 Command 加 Enter 的执行快捷键', () => {
    expect(isRunShortcut({ key: 'Enter', ctrlKey: true, metaKey: false })).toBe(true);
    expect(isRunShortcut({ key: 'Enter', ctrlKey: false, metaKey: true })).toBe(true);
    expect(isRunShortcut({ key: 'Enter', ctrlKey: false, metaKey: false })).toBe(false);
  });
});
