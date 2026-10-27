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
export function layoutManuscript(text) {
  const normalized = normalize(text);
  const cells = [];
  let row = 0;
  let count = 0;
  const lines = normalized.split('\n');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const characters = graphemes(lines[lineIndex]);
    for (let index = 0; index < characters.length; index++) {
      cells[row * COLUMNS + index] = characters[index];
      count++;
    }
    if (lineIndex < lines.length - 1) row += Math.max(1, Math.ceil(characters.length / COLUMNS));
  }
  // A trailing line break alone does not create a new blank sheet.
  const pageCount = Math.max(1, Math.ceil(cells.length / PAGE_SIZE));
  return { cells, count, pageCount };
}

export function safeFilename(title) {
  return (title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 80) || '無題の原稿') + '.txt';
}
