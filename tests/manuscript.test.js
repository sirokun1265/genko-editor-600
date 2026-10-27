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
