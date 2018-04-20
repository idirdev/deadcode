#!/usr/bin/env node
'use strict';

/**
 * @file bin/cli.js
 * @description CLI for deadcode — find unused exports in JavaScript projects.
 * @author idirdev
 */

const path = require('path');
const { findDeadCode, formatTable, formatJson, summary } = require('../src/index.js');

const args = process.argv.slice(2);

function parseArgs(argv) {
  const opts = {
    dir: '.',
    extensions: ['js', 'ts', 'mjs', 'cjs'],
    ignore: ['node_modules', 'dist', 'test', 'tests', '.git'],
    format: 'table',
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--extensions' && argv[i + 1]) {
      opts.extensions = argv[++i].split(',').map(s => s.trim());
    } else if (a === '--ignore' && argv[i + 1]) {
      opts.ignore = argv[++i].split(',').map(s => s.trim());
    } else if (a === '--format' && argv[i + 1]) {
      opts.format = argv[++i];
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--help' || a === '-h') {
      console.log([
        'Usage: deadcode [dir] [options]',
        '',
        'Options:',
        '  --extensions js,ts,mjs   File extensions to analyze (default: js,ts,mjs,cjs)',
        '  --ignore node_modules    Patterns to ignore (default: node_modules,dist,test,tests)',
        '  --format table|json      Output format (default: table)',
        '  --json                   Alias for --format json',
        '  -h, --help               Show help',
      ].join('\n'));
      process.exit(0);
    } else if (!a.startsWith('--')) {
      opts.dir = a;
    }
  }

  if (opts.json) opts.format = 'json';
  return opts;
}

const opts = parseArgs(args);
const absDir = path.resolve(opts.dir);

let results;
try {
  results = findDeadCode(absDir, { extensions: opts.extensions, ignore: opts.ignore });
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}

if (opts.format === 'json') {
  console.log(formatJson(results));
} else {
  console.log(formatTable(results));
  console.log(summary(results));
}

process.exit(results.length > 0 ? 1 : 0);
