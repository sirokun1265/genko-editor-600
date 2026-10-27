import { layoutManuscript, PAGE_SIZE, safeFilename } from './manuscript.js';

const $ = id => document.getElementById(id);
const storageKey = 'genko600.draft.v1';
const editor = $('manuscript');
const title = $('document-title');
let layout = layoutManuscript('');
let currentPage = 0;
let saveTimer;
let toastTimer;
let composing = false;
let storageUnavailable = false;

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function save() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(storageKey, JSON.stringify({ title: title.value, text: editor.value, options: layoutOptions(), savedAt: new Date().toISOString() }));
    storageUnavailable = false;
    $('save-state').classList.remove('error');
    $('save-label').textContent = 'この端末に保存済み';
  } catch {
    storageUnavailable = true;
    $('save-state').classList.add('error');
    $('save-label').textContent = '自動保存できません。テキスト保存してください';
  }
}
function queueSave() {
  clearTimeout(saveTimer);
  $('save-label').textContent = storageUnavailable ? 'テキスト保存で原稿を残してください' : '保存中…';
  saveTimer = setTimeout(save, 350);
}
function fillGrid(grid, pageIndex) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < PAGE_SIZE; index++) {
    const cell = document.createElement('span');
    const row = Math.floor(index / 20);
    cell.className = 'cell' + ((row + 1) % 5 === 0 ? ' row-end' : '');
    const position = pageIndex * PAGE_SIZE + index;
    const value = layout.cells[position] || '';
    const kind = layout.cellKinds[position];
    if (kind === 'hanging' || kind === 'punctuation-pair') {
      cell.classList.add('combined', kind);
      const main = document.createElement('span');
      main.className = 'cell-main';
      const tail = document.createElement('span');
      tail.className = 'cell-tail';
      const parts = layout.cellParts[position];
      main.textContent = parts.main;
      tail.textContent = parts.tail;
      cell.append(main, tail);
      cell.title = value;
    } else {
      cell.textContent = value;
      if (kind === 'ascii-pair') cell.classList.add('ascii-pair');
    }
    fragment.append(cell);
  }
  grid.replaceChildren(fragment);
}
function renderPage() {
  currentPage = Math.max(0, Math.min(currentPage, layout.pageCount - 1));
  fillGrid($('paper-grid'), currentPage);
  $('paper-grid').setAttribute('aria-label', `原稿用紙、${currentPage + 1}枚目`);
  $('paper-title').textContent = title.value.trim() || '無題の原稿';
  $('paper-page').textContent = String(currentPage + 1).padStart(2, '0');
  $('current-page').textContent = currentPage + 1;
  $('total-pages').textContent = layout.pageCount;
  $('previous-page').disabled = currentPage === 0;
  $('next-page').disabled = currentPage === layout.pageCount - 1;
}
function layoutOptions() {
  return { mode: $('layout-mode').value, packAscii: $('pack-ascii').checked, autoIndent: $('auto-indent').checked };
}
function update() {
  const options = layoutOptions();
  const strict = options.mode === 'strict';
  $('pack-ascii').disabled = strict;
  $('auto-indent').disabled = strict;
  layout = layoutManuscript(editor.value, options);
  $('character-count').textContent = layout.count.toLocaleString('ja-JP');
  const used = layout.cells.length % PAGE_SIZE || (layout.cells.length ? PAGE_SIZE : 0);
  $('progress-bar').style.width = `${used / PAGE_SIZE * 100}%`;
  $('cell-usage').textContent = `${used} / 600マス（最終ページ）`;
  $('layout-label').textContent = strict ? '1マス1字・禁則なし' : '原稿用紙のルールを適用';
  const messages = {
    'indent': '段落の先頭の一字下げを確認してください。書式設定から自動字下げも選べます。',
    'manual-line-start': '本文の先頭や手動改行の直後に句読点・閉じ括弧があります。改行位置を確認してください。',
    'double-mark': '三点リーダー・ダッシュは「……」「——」のように2字一組で使うのが一般的です。',
    'page-end-sharing': '用紙の最後のマスに文字と記号を一緒に入れています。字数制限がある場合は入力字数と提出先の指定を確認してください。'
  };
  const notices = layout.warnings.map(code => messages[code]);
  $('format-feedback').textContent = notices.join(' ');
  $('format-feedback').hidden = notices.length === 0;
  renderPage();
}
function changeView(view, focusTab = false) {
  $('workspace').dataset.view = view;
  for (const name of ['write', 'preview']) {
    const tab = $('tab-' + name);
    const selected = name === view;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (focusTab && selected) tab.focus();
  }
}
function download() {
  if (!editor.value && !title.value) { toast('本文を入力してから保存してください。'); return; }
  const blob = new Blob(['\ufeff', editor.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename(title.value);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('テキストファイルを保存します。');
}
function createPrintPages() {
  update();
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < layout.pageCount; index++) {
    const sheet = $('paper').cloneNode(true);
    sheet.removeAttribute('id');
    sheet.classList.add('print-sheet');
    sheet.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    sheet.querySelector('.paper-bottom span:last-child').textContent = `${index + 1} / ${layout.pageCount}`;
    fillGrid(sheet.querySelector('.paper-grid'), index);
    fragment.append(sheet);
  }
  $('print-root').replaceChildren(fragment);
}

try {
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    const draft = JSON.parse(stored);
    if (typeof draft.text === 'string' && typeof draft.title === 'string') {
      editor.value = draft.text;
      title.value = draft.title;
      if (draft.options && typeof draft.options === 'object') {
        $('layout-mode').value = draft.options.mode === 'strict' ? 'strict' : 'manuscript';
        $('pack-ascii').checked = draft.options.packAscii !== false;
        $('auto-indent').checked = draft.options.autoIndent === true;
      }
      $('save-label').textContent = '前回の原稿を復元しました';
    }
  }
} catch {
  storageUnavailable = true;
  $('save-state').classList.add('error');
  $('save-label').textContent = '自動保存を利用できません';
}

editor.addEventListener('compositionstart', () => { composing = true; });
editor.addEventListener('compositionend', () => { composing = false; update(); queueSave(); });
editor.addEventListener('input', () => { if (!composing) { update(); queueSave(); } });
title.addEventListener('input', () => { $('paper-title').textContent = title.value.trim() || '無題の原稿'; queueSave(); });
$('previous-page').addEventListener('click', () => { currentPage--; renderPage(); });
$('next-page').addEventListener('click', () => { currentPage++; renderPage(); });
for (const id of ['layout-mode', 'pack-ascii', 'auto-indent']) {
  $(id).addEventListener('change', () => { update(); queueSave(); });
}
for (const view of ['write', 'preview']) {
  $('tab-' + view).addEventListener('click', () => changeView(view));
  $('tab-' + view).addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      changeView(event.key === 'Home' ? 'write' : event.key === 'End' ? 'preview' : view === 'write' ? 'preview' : 'write', true);
    }
  });
}
$('indent-button').addEventListener('click', () => {
  const start = editor.selectionStart;
  editor.setRangeText('　', start, editor.selectionEnd, 'end');
  update(); queueSave(); editor.focus();
});
$('new-button').addEventListener('click', () => {
  if ((editor.value || title.value) && !confirm('新しい原稿を作成します。現在の原稿は置き換わります。必要な文章は先に「テキスト保存」で残してください。続けますか？')) return;
  title.value = ''; editor.value = ''; currentPage = 0;
  update(); save(); editor.focus();
});
$('download-button').addEventListener('click', download);
$('import-button').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 1024 * 1024) { toast('1MB以下のテキストファイルを選んでください。'); return; }
  try {
    const text = (await file.text()).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
    if ((editor.value || title.value) && !confirm('現在の原稿を、選んだファイルの内容に置き換えますか？必要な文章は先に「テキスト保存」で残してください。')) return;
    editor.value = text;
    title.value = file.name.replace(/\.txt$/i, '').slice(0, 100);
    currentPage = 0;
    update(); save(); changeView('write');
    toast('テキストファイルを開きました。');
  } catch { toast('ファイルを読み込めませんでした。UTF-8のテキストファイルを選んでください。'); }
});
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
$('close-help').addEventListener('click', () => $('help-dialog').close());
$('print-button').addEventListener('click', () => { createPrintPages(); window.print(); });
window.addEventListener('beforeprint', createPrintPages);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
window.addEventListener('pagehide', save);
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); download(); }
});
update();
