export const COLUMNS = 20;
export const ROWS = 30;
export const PAGE_SIZE = COLUMNS * ROWS;

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
export function graphemes(text) {
  return segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);
}
export function normalize(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\t/g, '　');
}
const OPENING = new Set(Array.from('「『（([［｛{【〈《〔“‘'));
const CLOSING = new Set(Array.from('」』）)]］｝}】〉》〕”’'));
const PUNCTUATION = new Set(Array.from('、。，．,.'));
const DOUBLE_MARKS = new Set(['…', '‥', '—', '―', '─']);

function tokensForLine(characters, packAscii) {
  const tokens = [];
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    const next = characters[index + 1];
    if (character === '。' && CLOSING.has(next)) {
      tokens.push({ text: character + next, kind: 'punctuation-pair', noStart: true });
      index++;
    } else if (packAscii && next && ((/^[0-9]$/.test(character) && /^[0-9]$/.test(next)) || (/^[a-z]$/.test(character) && /^[a-z]$/.test(next)))) {
      tokens.push({ text: character + next, kind: 'ascii-pair' });
      index++;
    } else if (DOUBLE_MARKS.has(character) && character === next) {
      tokens.push({ text: character + next, kind: 'double-mark', width: 2 });
      index++;
    } else {
      tokens.push({ text: character, kind: 'single', opening: OPENING.has(character), noStart: PUNCTUATION.has(character) || CLOSING.has(character) });
    }
  }
  return tokens;
}

// General manuscript conventions are not a universal examination rubric.
// Formatting affects the preview and printing, leaving the input text intact.
export function layoutManuscript(text, options = {}) {
  const normalized = normalize(text);
  const strict = options.mode === 'strict';
  const packAscii = !strict && options.packAscii !== false;
  const autoIndent = !strict && options.autoIndent === true;
  const cells = [];
  const cellKinds = [];
  const cellParts = [];
  const warnings = new Set();
  let cursor = 0;
  let pageEndSharing = false;
  let count = 0;
  const lines = normalized.split('\n');
  const put = (value, kind = 'single') => {
    cells[cursor] = value;
    cellKinds[cursor] = kind;
    if (kind === 'punctuation-pair') {
      const parts = graphemes(value);
      cellParts[cursor] = { main: parts.shift(), tail: parts.join('') };
    }
    cursor++;
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineStart = cursor;
    const needsIndent = line.length > 0 && !/^[\s「『]/u.test(line);
    if (autoIndent && needsIndent) put('　', 'auto-indent');
    if (!strict && !autoIndent && needsIndent) warnings.add('indent');
    const characters = graphemes(line);
    count += characters.length;
    const tokens = strict ? characters.map(character => ({ text: character, kind: 'single' })) : tokensForLine(characters, packAscii);
    if (!strict && tokens[0]?.noStart) warnings.add('manual-line-start');
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const column = cursor % COLUMNS;
      if (!strict && token.noStart && column === 0) {
        // Preserve explicit paragraph breaks; borrow only after automatic wraps.
        if (cursor > lineStart && cells[cursor - 1]) {
          cellParts[cursor - 1] ||= { main: cells[cursor - 1], tail: '' };
          cellParts[cursor - 1].tail += token.text;
          cells[cursor - 1] += token.text;
          cellKinds[cursor - 1] = 'hanging';
          if (cursor % PAGE_SIZE === 0) pageEndSharing = true;
          continue;
        }
        warnings.add('manual-line-start');
      }
      if (!strict && token.opening) {
        let openingCount = 1;
        while (tokens[index + openingCount]?.opening) openingCount++;
        const needed = Math.min(COLUMNS, openingCount + (tokens[index + openingCount]?.width || 1));
        if (column > 0 && COLUMNS - column < needed) cursor += COLUMNS - column;
      }
      if (token.kind === 'double-mark') {
        if (cursor % COLUMNS === COLUMNS - 1) cursor++;
        for (const character of graphemes(token.text)) put(character);
      } else {
        put(token.text, token.kind);
      }
    }
    if (!strict) {
      for (const match of line.matchAll(/[…‥—―─]+/gu)) {
        const run = graphemes(match[0]);
        if (run.some(character => character !== run[0]) || run.length % 2 !== 0) warnings.add('double-mark');
      }
    }
    if (lineIndex < lines.length - 1) cursor = Math.max(lineStart + COLUMNS, Math.ceil(cursor / COLUMNS) * COLUMNS);
  }
  // A trailing line break alone does not create a new blank sheet.
  const pageCount = Math.max(1, Math.ceil(cells.length / PAGE_SIZE));
  if (pageEndSharing) warnings.add('page-end-sharing');
  return { cells, cellKinds, cellParts, count, pageCount, warnings: [...warnings], pageEndSharing };
}

export function safeFilename(title) {
  return (title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 80) || '無題の原稿') + '.txt';
}
