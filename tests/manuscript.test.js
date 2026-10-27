import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutManuscript, safeFilename } from '../manuscript.js';

test('blank paper and exactly 600 characters occupy one sheet', () => {
  assert.equal(layoutManuscript('').pageCount, 1);
  const result = layoutManuscript('あ'.repeat(600));
  assert.equal(result.count, 600);
  assert.equal(result.pageCount, 1);
  assert.equal(result.cells[599], 'あ');
});
test('the 601st character starts the next sheet', () => {
  const result = layoutManuscript('あ'.repeat(600) + 'い');
  assert.equal(result.pageCount, 2);
  assert.equal(result.cells[600], 'い');
});
test('newlines advance rows, retaining blank lines without double wrapping', () => {
  assert.equal(layoutManuscript('あ\nい').cells[20], 'い');
  assert.equal(layoutManuscript('あ'.repeat(20) + '\nい').cells[20], 'い');
  assert.equal(layoutManuscript('あ\n\nい').cells[40], 'い');
  assert.equal(layoutManuscript('\nあ').cells[20], 'あ');
  assert.equal(layoutManuscript('あ'.repeat(600) + '\n').pageCount, 1);
  assert.equal(layoutManuscript('あ'.repeat(600) + '\nい').cells[600], 'い');
});
test('spaces, ASCII, emoji and combining characters each occupy one cell', () => {
  const result = layoutManuscript('A　 👨‍👩‍👧‍👦か\u3099');
  assert.equal(result.count, 5);
  assert.equal(result.cells[3], '👨‍👩‍👧‍👦');
  assert.equal(result.cells[4], 'か\u3099');
});
test('CRLF and tabs are normalized for paper layout', () => {
  const result = layoutManuscript('あ\r\n\tい');
  assert.equal(result.count, 3);
  assert.equal(result.cells[20], '　');
  assert.equal(result.cells[21], 'い');
});
test('each sheet has 30 rows and paragraph overflow remains correct', () => {
  const result = layoutManuscript(Array(31).fill('あ').join('\n'));
  assert.equal(result.count, 31);
  assert.equal(result.pageCount, 2);
  assert.equal(result.cells[600], 'あ');
  assert.equal(layoutManuscript('あ'.repeat(21) + '\nい').cells[40], 'い');
});
test('download filenames cannot contain path separators', () => {
  assert.equal(safeFilename(''), '無題の原稿.txt');
  assert.equal(safeFilename('題名/下書き:*'), '題名_下書き__.txt');
});

test('punctuation alone in column 20 uses its own cell', () => {
  for (const punctuation of ['。', '、']) {
    const result = layoutManuscript('あ'.repeat(19) + punctuation);
    assert.equal(result.cells[19], punctuation);
    assert.equal(result.cellKinds[19], 'single');
    assert.equal(result.cells.length, 20);
  }
});

test('punctuation overflowing a row shares the last cell; following text starts the next row', () => {
  for (const mark of ['。', '、', '」', '』', '）']) {
    const result = layoutManuscript('あ'.repeat(20) + mark + '次');
    assert.equal(result.cells[19], 'あ' + mark);
    assert.equal(result.cells[20], '次');
    assert.equal(result.cellKinds[19], 'hanging');
    assert.equal(result.count, 22);
  }
});

test('a period and closing bracket share a cell in the middle of a row', () => {
  const result = layoutManuscript('「はい。」次');
  assert.deepEqual(result.cells, ['「', 'は', 'い', '。」', '次']);
  assert.deepEqual(result.cellParts[3], { main: '。', tail: '」' });
  assert.equal(result.count, 6);
});

test('a hanging period and closing bracket retain both symbols', () => {
  const result = layoutManuscript('あ'.repeat(20) + '。」次');
  assert.equal(result.cells[19], 'あ。」');
  assert.deepEqual(result.cellParts[19], { main: 'あ', tail: '。」' });
  assert.equal(result.cells[20], '次');
});

test('opening brackets and their content move together at a row boundary', () => {
  const result = layoutManuscript('あ'.repeat(19) + '「次」');
  assert.equal(result.cells[19], undefined);
  assert.equal(result.cells[20], '「');
  assert.equal(result.cells[21], '次');
  const nested = layoutManuscript('あ'.repeat(18) + '「『次』」');
  assert.equal(nested.cells[18], undefined);
  assert.equal(nested.cells[20], '「');
  assert.equal(nested.cells[21], '『');
  assert.equal(nested.cells[22], '次');
});

test('page-end sharing does not conceal the true input character count', () => {
  const result = layoutManuscript('あ'.repeat(600) + '。');
  assert.equal(result.pageCount, 1);
  assert.equal(result.cells[599], 'あ。');
  assert.equal(result.count, 601);
  assert.ok(result.warnings.includes('page-end-sharing'));
  const continued = layoutManuscript('あ'.repeat(600) + '。次');
  assert.equal(continued.cells[600], '次');
  assert.equal(continued.pageCount, 2);
});

test('strict mode keeps every character in its own cell', () => {
  const result = layoutManuscript('あ'.repeat(600) + '。', { mode: 'strict', autoIndent: true, packAscii: true });
  assert.equal(result.cells[600], '。');
  assert.equal(result.pageCount, 2);
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(layoutManuscript('12。」', { mode: 'strict' }).cells, ['1', '2', '。', '」']);
});

test('halfwidth digits and lowercase letters can be paired without reducing input count', () => {
  const result = layoutManuscript('2026年abcABC');
  assert.deepEqual(result.cells, ['20', '26', '年', 'ab', 'c', 'A', 'B', 'C']);
  assert.equal(result.count, 11);
  assert.deepEqual(layoutManuscript('2026', { packAscii: false }).cells, ['2', '0', '2', '6']);
  assert.deepEqual(layoutManuscript('a1ＡＢ１２').cells, ['a', '1', 'Ａ', 'Ｂ', '１', '２']);
  const hanging = layoutManuscript('あ'.repeat(19) + '12。');
  assert.deepEqual(hanging.cellParts[19], { main: '12', tail: '。' });
});

test('automatic indentation preserves existing whitespace and dialogue openings', () => {
  const input = '本文\n　字下げ済み\n「会話」\n\n次の段落';
  const result = layoutManuscript(input, { autoIndent: true });
  assert.equal(result.cells[0], '　');
  assert.equal(result.cells[1], '本');
  assert.equal(result.cells[20], '　');
  assert.equal(result.cells[21], '字');
  assert.equal(result.cells[40], '「');
  assert.equal(result.cells[80], '　');
  assert.equal(result.cells[81], '次');
  assert.equal(result.count, 16);
});

test('explicit paragraph breaks remain intact and invalid leading marks are reported', () => {
  const result = layoutManuscript('あ'.repeat(20) + '\n。次');
  assert.equal(result.cells[19], 'あ');
  assert.equal(result.cells[20], '。');
  assert.ok(result.warnings.includes('manual-line-start'));
  assert.ok(layoutManuscript('。', { autoIndent: true }).warnings.includes('manual-line-start'));
  assert.equal(layoutManuscript('か\n\u3099').count, 2);
});

test('paired ellipses and dashes occupy two cells without being split across rows', () => {
  for (const mark of ['…', '—', '―']) {
    const result = layoutManuscript('あ'.repeat(19) + mark.repeat(2));
    assert.equal(result.cells[19], undefined);
    assert.equal(result.cells[20], mark);
    assert.equal(result.cells[21], mark);
    assert.ok(!result.warnings.includes('double-mark'));
    assert.ok(layoutManuscript(mark).warnings.includes('double-mark'));
    assert.ok(layoutManuscript(mark.repeat(3)).warnings.includes('double-mark'));
  }
});

test('small kana and long vowel marks keep their own cells, including at the start of a row', () => {
  for (const character of ['っ', 'ゃ', 'ゅ', 'ょ', 'ー']) {
    const result = layoutManuscript('あ'.repeat(20) + character);
    assert.equal(result.cells[20], character);
    assert.equal(result.cells[19], 'あ');
  }
});

test('layout retains every input grapheme across punctuation, wrapping and blank lines', () => {
  const samples = ['「会話です。」\n次の文は2026年。', 'あ'.repeat(599) + '「語。」……', 'か\u3099👨‍👩‍👧‍👦'.repeat(31) + '。』', '\n\n2026abc、\n　次。'];
  for (const input of samples) {
    const result = layoutManuscript(input);
    assert.equal(result.cells.filter(Boolean).join(''), input.replace(/\n/g, ''));
    assert.equal(result.cells.length, result.cellKinds.length);
  }
});
