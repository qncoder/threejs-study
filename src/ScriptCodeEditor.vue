<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import 'monaco-editor/min/vs/editor/editor.main.css';

if (typeof self !== 'undefined' && !self.MonacoEnvironment) {
  self.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === 'javascript' || label === 'typescript') return new tsWorker();

      return new editorWorker();
    },
  };
}

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  ariaLabel: {
    type: String,
    default: '代码编辑器',
  },
});

const emit = defineEmits(['update:modelValue', 'run']);

const editorHost = ref(null);
let editor = null;
let changeDisposable = null;

onMounted(() => {
  editor = monaco.editor.create(editorHost.value, {
    value: props.modelValue,
    language: 'javascript',
    theme: 'vs-dark',
    ariaLabel: props.ariaLabel,
    automaticLayout: true,
    fontFamily: '"Cascadia Code", "Consolas", "SFMono-Regular", monospace',
    fontSize: 13,
    lineHeight: 21,
    tabSize: 2,
    insertSpaces: true,
    minimap: { enabled: false },
    folding: false,
    lineNumbersMinChars: 3,
    overviewRulerLanes: 0,
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: 'line',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    scrollbar: {
      horizontalScrollbarSize: 10,
      verticalScrollbarSize: 10,
    },
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    emit('run');
  });

  changeDisposable = editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.getValue());
  });

  nextTick(() => {
    moveCursorToEnd();
    editor?.focus();
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || value === editor.getValue()) return;

    const position = editor.getPosition();
    editor.setValue(value ?? '');
    if (position) editor.setPosition(position);
  },
);

onBeforeUnmount(() => {
  changeDisposable?.dispose();
  editor?.dispose();
  changeDisposable = null;
  editor = null;
});

function insertText(text) {
  if (!editor) return false;

  editor.executeEdits('script-toolbar', [
    {
      range: editor.getSelection(),
      text,
      forceMoveMarkers: true,
    },
  ]);
  editor.focus();
  return true;
}

function focus() {
  editor?.focus();
}

function moveCursorToEnd() {
  const model = editor?.getModel();
  if (!editor || !model) return;

  const lastLineNumber = model.getLineCount();
  editor.setPosition({
    lineNumber: lastLineNumber,
    column: model.getLineMaxColumn(lastLineNumber),
  });
}

defineExpose({
  focus,
  insertText,
});
</script>

<template>
  <div ref="editorHost" class="code-editor" />
</template>
