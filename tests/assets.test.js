import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
test('the stylesheet, entry module and layout module use the same release version', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const app = await readFile(new URL('app.js', root), 'utf8');
  const stylesheet = html.match(/href="(\.\/styles\.css\?v=[^"]+)"/)?.[1];
  const entry = html.match(/import\('(\.\/app\.js\?v=[^']+)'\)/)?.[1];
  const layoutModule = app.match(/from '(\.\/manuscript\.js\?v=[^']+)'/)?.[1];
  assert.ok(stylesheet, 'the stylesheet needs a versioned URL');
  assert.ok(entry, 'the app needs a versioned URL');
  assert.ok(layoutModule, 'the layout dependency also needs a versioned URL');
  const versions = [stylesheet, entry, layoutModule].map(url => new URL(url, root).searchParams.get('v'));
  assert.equal(new Set(versions).size, 1, 'mixed asset releases can prevent the grid from rendering');
  for (const asset of [stylesheet, entry, layoutModule]) await access(new URL(asset.split('?')[0], root));
});
