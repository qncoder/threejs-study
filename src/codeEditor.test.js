import { describe, expect, test } from 'vitest';
import { createScriptSnippetInsertion } from './codeEditor.js';

describe('createScriptSnippetInsertion', () => {
  test('空脚本直接插入片段', () => {
    expect(createScriptSnippetInsertion('', 'setPosition(0, 0, 0);')).toBe('setPosition(0, 0, 0);');
  });

  test('已有脚本时在片段前补换行', () => {
    expect(createScriptSnippetInsertion('setScale(1, 1, 1);', 'setPosition(0, 0, 0);')).toBe(
      '\nsetPosition(0, 0, 0);',
    );
  });

  test('只有空白内容时不补换行', () => {
    expect(createScriptSnippetInsertion('  \n', 'setPosition(0, 0, 0);')).toBe('setPosition(0, 0, 0);');
  });
});
