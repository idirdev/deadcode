'use strict';

/**
 * @file tests/index.test.js
 * @description Tests for deadcode package.
 * @author idirdev
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { collectFiles, parseExports, parseImports, findDeadCode, formatTable, formatJson, summary } = require('../src/index.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'deadcode-test-'));
}

function writeFile(dir, name, content) {
  const fp = path.join(dir, name);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
  return fp;
}

test('collectFiles finds js files', () => {
  const dir = makeTmpDir();
  writeFile(dir, 'a.js', '');
  writeFile(dir, 'b.ts', '');
  writeFile(dir, 'c.txt', '');
  const files = collectFiles(dir, { extensions: ['js', 'ts'] });
  assert.equal(files.length, 2);
});

test('collectFiles respects ignore patterns', () => {
  const dir = makeTmpDir();
  writeFile(dir, 'src/a.js', '');
  writeFile(dir, 'node_modules/x.js', '');
  const files = collectFiles(dir, { ignore: ['node_modules'] });
  assert.equal(files.length, 1);
  assert.ok(files[0].includes('src'));
});

test('parseExports detects exports.foo = ...', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'a.js', "exports.foo = 42;\nexports.bar = function() {};\n");
  const exps = parseExports(fp);
  const names = exps.map(e => e.name);
  assert.ok(names.includes('foo'));
  assert.ok(names.includes('bar'));
});

test('parseExports detects module.exports = { ... }', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'b.js', "module.exports = { alpha, beta, gamma };\n");
  const exps = parseExports(fp);
  const names = exps.map(e => e.name);
  assert.ok(names.includes('alpha'));
  assert.ok(names.includes('beta'));
  assert.ok(names.includes('gamma'));
});

test('parseExports detects ESM named exports', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'c.mjs', "export const hello = 1;\nexport function world() {}\n");
  const exps = parseExports(fp);
  const names = exps.map(e => e.name);
  assert.ok(names.includes('hello'));
  assert.ok(names.includes('world'));
});

test('parseExports detects export default', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'd.js', "export default function MyFunc() {}\n");
  const exps = parseExports(fp);
  assert.equal(exps.length, 1);
  assert.equal(exps[0].name, 'MyFunc');
  assert.equal(exps[0].type, 'esm-default');
});

test('parseImports detects require destructuring', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'e.js', "const { foo, bar } = require('./lib');\n");
  const names = parseImports(fp);
  assert.ok(names.includes('foo'));
  assert.ok(names.includes('bar'));
});

test('parseImports detects ESM imports', () => {
  const dir = makeTmpDir();
  const fp = writeFile(dir, 'f.mjs', "import { alpha, beta } from './mod';\nimport MyDefault from './other';\n");
  const names = parseImports(fp);
  assert.ok(names.includes('alpha'));
  assert.ok(names.includes('beta'));
  assert.ok(names.includes('MyDefault'));
});

test('findDeadCode detects unused exports', () => {
  const dir = makeTmpDir();
  // lib exports foo and bar; main only imports foo
  writeFile(dir, 'lib.js', "exports.foo = 1;\nexports.bar = 2;\n");
  writeFile(dir, 'main.js', "const { foo } = require('./lib');\nconsole.log(foo);\n");
  const results = findDeadCode(dir);
  const names = results.map(r => r.name);
  assert.ok(names.includes('bar'), 'bar should be detected as unused');
  assert.ok(!names.includes('foo'), 'foo should NOT be detected as unused');
});

test('findDeadCode returns empty when all exports used', () => {
  const dir = makeTmpDir();
  writeFile(dir, 'lib.js', "exports.used = 42;\n");
  writeFile(dir, 'main.js', "const { used } = require('./lib');\n");
  const results = findDeadCode(dir);
  assert.equal(results.length, 0);
});

test('formatTable returns header and rows', () => {
  const results = [{ file: '/proj/lib.js', name: 'bar', type: 'commonjs', line: 2 }];
  const out = formatTable(results);
  assert.ok(out.includes('bar'));
  assert.ok(out.includes('File'));
});

test('formatTable returns no-unused message on empty', () => {
  const out = formatTable([]);
  assert.ok(out.includes('No unused'));
});

test('formatJson returns valid JSON', () => {
  const results = [{ file: '/a.js', name: 'x', type: 'esm-named', line: 1 }];
  const json = JSON.parse(formatJson(results));
  assert.equal(json[0].name, 'x');
});

test('summary returns correct count string', () => {
  assert.ok(summary([]).includes('0'));
  assert.ok(summary([{}]).includes('1'));
});
