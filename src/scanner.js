'use strict';

function findExports(content, file) {
  const exports = [];
  content.split('\n').forEach((line, i) => {
    let m;
    if ((m = line.match(/^export\s+(?:const|let|var|function|class|async\s+function)\s+([a-zA-Z_$][\w$]*)/))) {
      exports.push({ name: m[1], type: 'export', file, line: i + 1 });
    }
    const named = line.match(/^export\s*\{([^}]+)\}/);
    if (named) named[1].split(',').forEach(n => {
      const name = n.trim().split(/\s+as\s+/).pop().trim();
      if (name) exports.push({ name, type: 'named-export', file, line: i + 1 });
    });
    if ((m = line.match(/(?:module\.)?exports\.(\w+)\s*=/))) {
      exports.push({ name: m[1], type: 'cjs-export', file, line: i + 1 });
    }
  });
  return exports;
}

function findImports(content) {
  const imports = new Set();
  content.split('\n').forEach(line => {
    const esm = line.match(/import\s*\{([^}]+)\}\s*from/);
    if (esm) esm[1].split(',').forEach(n => imports.add(n.trim().split(/\s+as\s+/)[0].trim()));
    const cjs = line.match(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(/);
    if (cjs) cjs[1].split(',').forEach(n => imports.add(n.trim().split(/\s*:\s*/)[0].trim()));
    const calls = line.match(/\b(\w+)\s*\(/g);
    if (calls) calls.forEach(u => imports.add(u.replace(/\s*\($/, '')));
  });
  return imports;
}

module.exports = { findExports, findImports };
