'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { findExports, findImports } = require('../src/scanner');
const { findDeadCode } = require('../src/index');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('findExports', () => {
  it('ES exports', () => {
    const r = findExports('export const foo = 1;\nexport function bar() {}', 'a.js');
    assert.equal(r.length, 2);
  });
  it('named exports', () => {
    const r = findExports('export { foo, bar }', 'a.js');
    assert.equal(r.length, 2);
  });
  it('CJS exports', () => {
    const r = findExports('exports.hello = 1;', 'a.js');
    assert.ok(r.some(e => e.name === 'hello'));
  });
});

describe('findImports', () => {
  it('ES imports', () => {
    const r = findImports('import { foo } from "./a"');
    assert.ok(r.has('foo'));
  });
  it('CJS require', () => {
    const r = findImports('const { bar } = require("./a")');
    assert.ok(r.has('bar'));
  });
});

describe('findDeadCode', () => {
  it('finds unused', () => {
    const dir = path.join(os.tmpdir(), 'dc-' + Date.now());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.js'), 'export const used = 1;\nexport const unused = 2;');
    fs.writeFileSync(path.join(dir, 'b.js'), 'import { used } from "./a";\nused();');
    const r = findDeadCode(dir);
    assert.ok(r.some(e => e.name === 'unused'));
    fs.rmSync(dir, { recursive: true });
  });
});
