'use strict';

/**
 * @module deadcode
 * @description Find unused exports and dead code in JavaScript projects.
 * @author idirdev
 */

const fs = require('fs');
const path = require('path');

/**
 * Recursively collect files from a directory with extension and ignore filters.
 * @param {string} dir - Root directory to walk.
 * @param {object} [opts={}] - Options.
 * @param {string[]} [opts.extensions=['js','mjs','cjs','ts']] - File extensions to include.
 * @param {string[]} [opts.ignore=['node_modules','dist','.git']] - Directory/file names to ignore.
 * @returns {string[]} Absolute file paths.
 */
function collectFiles(dir, opts = {}) {
  const extensions = opts.extensions || ['js', 'mjs', 'cjs', 'ts'];
  const ignore = opts.ignore || ['node_modules', 'dist', '.git'];
  const results = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      if (ignore.includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).replace('.', '');
        if (extensions.includes(ext)) {
          results.push(full);
        }
      }
    }
  }

  walk(path.resolve(dir));
  return results;
}

/**
 * Parse export names from a file using regex patterns.
 * Detects: module.exports, exports.X, export default, export const/function/class.
 * @param {string} filePath - Absolute path to the file.
 * @returns {Array<{name:string, type:string, line:number}>} Detected exports.
 */
function parseExports(filePath) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return [];
  }

  const lines = src.split('\n');
  const found = [];

  const patterns = [
    // exports.foo = ...
    { re: /^\s*exports\.([A-Za-z_$][\w$]*)\s*=/, type: 'commonjs' },
    // module.exports.foo = ...
    { re: /^\s*module\.exports\.([A-Za-z_$][\w$]*)\s*=/, type: 'commonjs' },
    // module.exports = { foo, bar }
    { re: null, special: 'moduleExportsObj' },
    // export default
    { re: /^\s*export\s+default\s+(?:function|class)?\s*([A-Za-z_$][\w$]*)/, type: 'esm-default', nameGroup: 1 },
    // export const/let/var/function/class foo
    { re: /^\s*export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/, type: 'esm-named', nameGroup: 1 },
    // export { foo, bar }
    { re: null, special: 'exportBraces' },
  ];

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    // exports.foo = ...
    let m = line.match(/^\s*exports\.([A-Za-z_$][\w$]*)\s*=/);
    if (m) {
      found.push({ name: m[1], type: 'commonjs', line: lineNo });
      return;
    }

    // module.exports.foo = ...
    m = line.match(/^\s*module\.exports\.([A-Za-z_$][\w$]*)\s*=/);
    if (m) {
      found.push({ name: m[1], type: 'commonjs', line: lineNo });
      return;
    }

    // module.exports = { foo, bar, baz }
    m = line.match(/^\s*module\.exports\s*=\s*\{([^}]+)\}/);
    if (m) {
      const names = m[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);
      for (const name of names) {
        if (/^[A-Za-z_$][\w$]*$/.test(name)) {
          found.push({ name, type: 'commonjs', line: lineNo });
        }
      }
      return;
    }

    // export default function/class Name
    m = line.match(/^\s*export\s+default\s+(?:function|class)\s+([A-Za-z_$][\w$]*)/);
    if (m) {
      found.push({ name: m[1], type: 'esm-default', line: lineNo });
      return;
    }

    // export default (anonymous)
    m = line.match(/^\s*export\s+default\b/);
    if (m) {
      found.push({ name: 'default', type: 'esm-default', line: lineNo });
      return;
    }

    // export const/let/var/function/class foo
    m = line.match(/^\s*export\s+(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/);
    if (m) {
      found.push({ name: m[1], type: 'esm-named', line: lineNo });
      return;
    }

    // export { foo, bar as baz }
    m = line.match(/^\s*export\s+\{([^}]+)\}/);
    if (m) {
      const names = m[1].split(',').map(s => {
        const parts = s.trim().split(/\s+as\s+/);
        return (parts[parts.length - 1] || '').trim();
      }).filter(n => /^[A-Za-z_$][\w$]*$/.test(n));
      for (const name of names) {
        found.push({ name, type: 'esm-named', line: lineNo });
      }
    }
  });

  return found;
}

/**
 * Parse all imported/required names from a file.
 * Detects: require(), import statements, destructured imports.
 * @param {string} filePath - Absolute path to the file.
 * @returns {string[]} List of imported names.
 */
function parseImports(filePath) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return [];
  }

  const imported = new Set();
  const lines = src.split('\n');

  for (const line of lines) {
    // const { foo, bar } = require('...')
    let m = line.match(/const\s+\{([^}]+)\}\s*=\s*require/);
    if (m) {
      m[1].split(',').forEach(s => {
        const name = s.trim().split(/\s+as\s+/)[0].trim();
        if (name) imported.add(name);
      });
    }

    // const foo = require('...')
    m = line.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*require/);
    if (m) imported.add(m[1]);

    // import { foo, bar } from '...'
    m = line.match(/import\s+\{([^}]+)\}\s+from/);
    if (m) {
      m[1].split(',').forEach(s => {
        const parts = s.trim().split(/\s+as\s+/);
        const name = (parts[parts.length - 1] || '').trim();
        if (name) imported.add(name);
      });
    }

    // import foo from '...'
    m = line.match(/import\s+([A-Za-z_$][\w$]*)\s+from/);
    if (m && m[1] !== 'type') imported.add(m[1]);

    // import * as foo from '...'
    m = line.match(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (m) imported.add(m[1]);
  }

  return Array.from(imported);
}

/**
 * Cross-reference exports vs imports across all files to find unused exports.
 * @param {string} dir - Root directory to analyze.
 * @param {object} [opts={}] - Options passed to collectFiles.
 * @returns {Array<{file:string, name:string, type:string, line:number}>} Unused exports.
 */
function findDeadCode(dir, opts = {}) {
  const files = collectFiles(dir, opts);
  const allImported = new Set();

  // Collect all imported names across the project
  for (const file of files) {
    const names = parseImports(file);
    for (const n of names) allImported.add(n);
  }

  const dead = [];

  for (const file of files) {
    const exports_ = parseExports(file);
    for (const exp of exports_) {
      if (!allImported.has(exp.name)) {
        dead.push({ file, name: exp.name, type: exp.type, line: exp.line });
      }
    }
  }

  return dead;
}

/**
 * Format dead code results as a human-readable table string.
 * @param {Array<{file:string, name:string, type:string, line:number}>} results
 * @returns {string}
 */
function formatTable(results) {
  if (results.length === 0) return 'No unused exports found.\n';

  const header = ['File', 'Export', 'Type', 'Line'];
  const rows = results.map(r => [
    path.basename(r.file),
    r.name,
    r.type,
    String(r.line),
  ]);

  const cols = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));

  const fmt = row => row.map((cell, i) => cell.padEnd(cols[i])).join('  ');
  const sep = cols.map(c => '-'.repeat(c)).join('  ');

  return [fmt(header), sep, ...rows.map(fmt)].join('\n') + '\n';
}

/**
 * Format dead code results as JSON string.
 * @param {Array<object>} results
 * @returns {string}
 */
function formatJson(results) {
  return JSON.stringify(results, null, 2);
}

/**
 * Return a short summary string of the dead code analysis.
 * @param {Array<object>} results
 * @returns {string}
 */
function summary(results) {
  return `Found ${results.length} unused export${results.length !== 1 ? 's' : ''}.`;
}

module.exports = { collectFiles, parseExports, parseImports, findDeadCode, formatTable, formatJson, summary };
