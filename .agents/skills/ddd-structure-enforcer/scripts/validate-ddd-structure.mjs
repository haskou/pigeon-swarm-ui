#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback = undefined) => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
};
const hasFlag = name => args.includes(name);

const root = path.resolve(getArg('--root', '.'));
const requestedFlavor = getArg('--flavor', 'auto');
const format = getArg('--format', 'text');
const failOnWarn = hasFlag('--fail-on-warn');

const ignore = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage',
  'out', 'target', 'bin', 'obj', '.turbo', '.cache', 'vendor', '__pycache__'
]);

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const technicalTopFolders = ['controllers', 'routes', 'services', 'models', 'repositories', 'components', 'hooks', 'stores'];
const genericModuleNames = new Set(['data', 'logic', 'service', 'services', 'model', 'models', 'manager', 'managers', 'helper', 'helpers', 'util', 'utils', 'common', 'shared', 'lib', 'core', 'base', 'misc']);
const allowedSpecialFolders = new Set(['__tests__', '__mocks__', '__fixtures__']);

function isKebabCase(name) {
  if (allowedSpecialFolders.has(name)) return true;
  if (/^\(.+\)$/.test(name) || /^\[.+\]$/.test(name)) return true;
  if (name.startsWith('.')) return true;
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name);
}

function stripKnownFileSuffixes(base) {
  return base
    .replace(/\.d$/, '')
    .replace(/\.(test|spec|stories|story|config|module|controller|routes|route|page|layout|template|schema|dto)$/i, match => {
      const lower = match.toLowerCase();
      if (['.test', '.spec', '.stories', '.story', '.d'].includes(lower)) return '';
      return match;
    });
}

function isLowerCamelCase(name) {
  if (name === 'index') return true;
  if (/^\[.+\]$/.test(name)) return true;
  return /^[a-z][A-Za-z0-9]*$/.test(name);
}

function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function shouldCheckNaming(fileRel) {
  const parts = fileRel.split('/');
  if (parts.some(p => ignore.has(p))) return false;
  return parts.includes('src') || parts[0] === 'src';
}

function validateNaming(files, modules) {
  const warn = [];
  const sourceFiles = files.filter(file => sourceExtensions.has(path.extname(file))).sort();

  const dirs = new Set();
  for (const file of sourceFiles) {
    const fileRel = rel(file);
    if (!shouldCheckNaming(fileRel)) continue;
    const parts = fileRel.split('/');
    for (let i = 0; i < parts.length - 1; i++) dirs.add(parts.slice(0, i + 1).join('/'));

    const parsed = path.parse(fileRel);
    const base = stripKnownFileSuffixes(parsed.name);
    if (!isLowerCamelCase(base)) {
      warn.push(`${fileRel}: file name should be lowerCamelCase; keep exported classes/types PascalCase if applicable.`);
    }

    let content = '';
    try { content = fs.readFileSync(file, 'utf8').slice(0, 200000); } catch { continue; }
    const classLike = [
      /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/g,
      /(?:export\s+)?interface\s+([A-Za-z_][A-Za-z0-9_]*)/g,
      /(?:export\s+)?type\s+([A-Za-z_][A-Za-z0-9_]*)/g,
      /(?:export\s+)?enum\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    ];
    for (const re of classLike) {
      let m;
      while ((m = re.exec(content))) {
        if (!isPascalCase(m[1])) warn.push(`${fileRel}: class/type '${m[1]}' should be PascalCase.`);
      }
    }
    const fnRe = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    let fm;
    while ((fm = fnRe.exec(content))) {
      if (!isLowerCamelCase(fm[1])) warn.push(`${fileRel}: function '${fm[1]}' should be lowerCamelCase.`);
    }
  }

  for (const dirRel of [...dirs].sort()) {
    const name = dirRel.split('/').pop();
    if (!name || ['src'].includes(name)) continue;
    if (!isKebabCase(name)) warn.push(`${dirRel}: folder name should be kebab-case.`);
  }

  for (const mod of modules) {
    if (genericModuleNames.has(mod.name)) {
      warn.push(`${rel(mod.path)}: module name '${mod.name}' is generic; prefer ubiquitous business language.`);
    }
    if (!isKebabCase(mod.name)) {
      warn.push(`${rel(mod.path)}: module folder should be kebab-case.`);
    }
  }

  return warn;
}

const flavors = {
  strict: {
    containerNames: ['modules'],
    baseCandidates: ['src/modules'],
    layers: ['domain', 'application', 'infrastructure', 'presentation'],
    domainForbiddenLayers: ['application', 'infrastructure', 'presentation', 'api', 'ui'],
    applicationForbiddenLayers: ['presentation', 'ui'],
  },
  'backend-module': {
    containerNames: ['modules'],
    baseCandidates: ['src/modules'],
    layers: ['domain', 'application', 'infrastructure', 'presentation'],
    domainForbiddenLayers: ['application', 'infrastructure', 'presentation', 'api', 'ui'],
    applicationForbiddenLayers: ['presentation', 'ui'],
  },
  'frontend-feature': {
    containerNames: ['features'],
    baseCandidates: ['src/features'],
    layers: ['domain', 'application', 'api', 'ui'],
    domainForbiddenLayers: ['application', 'infrastructure', 'presentation', 'api', 'ui'],
    applicationForbiddenLayers: ['presentation', 'ui'],
  },
  'fullstack-split': {
    baseCandidates: [
      'apps/web/src/modules',
      'apps/api/src/modules',
      'apps/frontend/src/modules',
      'apps/backend/src/modules',
      'packages/web/src/modules',
      'packages/api/src/modules',
      'packages/frontend/src/modules',
      'packages/backend/src/modules'
    ],
    layers: ['domain', 'application', 'infrastructure', 'presentation'],
    domainForbiddenLayers: ['application', 'infrastructure', 'presentation', 'api', 'ui'],
    applicationForbiddenLayers: ['presentation', 'ui'],
  }
};

const canonicalInnerFolders = {
  domain: ['entities', 'value-objects', 'aggregates', 'domain-services', 'events', 'repositories'],
  application: ['commands', 'queries', 'use-cases', 'dto'],
  infrastructure: ['prisma', 'postgres', 'redis', 'email', 'http'],
  presentation: ['controllers', 'routes', 'graphql', 'rest']
};

const externalForbiddenInDomain = [
  'react', 'react-dom', 'next', 'next/', 'vue', '@angular/', 'svelte', '@sveltejs/', '@remix-run/',
  'express', '@nestjs/', 'fastify', 'hono', 'koa', 'apollo-server', '@apollo/', 'graphql-yoga',
  '@prisma/', 'prisma', 'typeorm', 'sequelize', 'mongoose', 'pg', 'mysql2', 'sqlite3', 'redis',
  'axios', 'got', 'ky', 'superagent', 'firebase', '@supabase/', 'aws-sdk', '@aws-sdk/',
  'localforage', 'zustand', 'redux', '@reduxjs/', 'mobx', 'pinia', 'vue-router', 'react-router',
  'analytics', 'posthog-js', '@sentry/'
];

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !ignore.has(d.name))
      .map(d => d.name)
      .sort();
  } catch {
    return [];
  }
}

function walk(dir, acc = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function rel(p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function detectProjectKind() {
  const pkg = readJson(path.join(root, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const names = Object.keys(deps);
  const has = n => names.includes(n);
  const hasFrontend = has('react') || has('next') || has('vue') || has('@angular/core') || has('svelte') || exists(path.join(root, 'src', 'components')) || exists(path.join(root, 'src', 'pages'));
  const hasBackend = has('express') || has('@nestjs/core') || has('fastify') || has('hono') || has('@prisma/client') || has('typeorm') || has('sequelize') || has('mongoose') || exists(path.join(root, 'src', 'controllers')) || exists(path.join(root, 'src', 'routes')) || exists(path.join(root, 'server'));
  if (exists(path.join(root, 'apps')) || (hasFrontend && hasBackend)) return 'full-stack';
  if (hasFrontend) return 'frontend';
  if (hasBackend) return 'backend';
  return 'unknown';
}

function findModulesForFlavor(flavor) {
  if (flavor === 'auto') return [];
  const def = flavors[flavor] ?? flavors.strict;
  const candidates = [];

  for (const baseRel of def.baseCandidates) {
    const base = path.join(root, baseRel);
    if (!exists(base)) continue;
    for (const name of listDirs(base)) {
      candidates.push({ name, path: path.join(base, name), base: baseRel, expectedLayers: def.layers });
    }
  }
  return candidates;
}

function detectDddLikeDirs() {
  const dirs = [];
  function walkDirs(dir, depth = 0) {
    if (depth > 6) return;
    for (const name of listDirs(dir)) {
      const full = path.join(dir, name);
      const children = new Set(listDirs(full));
      const strictScore = ['domain', 'application', 'infrastructure', 'presentation'].filter(x => children.has(x)).length;
      const frontendScore = ['domain', 'application', 'api', 'ui'].filter(x => children.has(x)).length;
      const customScore = ['domain', 'application', 'adapters', 'delivery', 'use-cases'].filter(x => children.has(x)).length;
      if (strictScore >= 2 || frontendScore >= 2 || customScore >= 2) {
        dirs.push({ path: full, strictScore, frontendScore, customScore, layers: [...children].filter(x => ['domain','application','infrastructure','presentation','api','ui','adapters','delivery','use-cases'].includes(x)).sort() });
      }
      walkDirs(full, depth + 1);
    }
  }
  walkDirs(root);
  return dirs;
}

function inferFlavor(projectKind, dddLike) {
  const strict = dddLike.filter(x => x.strictScore >= 3).length;
  const frontend = dddLike.filter(x => x.frontendScore >= 3).length;
  if (frontend > strict) return 'frontend-feature';
  if (strict > 0) return 'strict';
  if (projectKind === 'full-stack') return 'fullstack-split';
  return 'none';
}

function parseImports(content) {
  const imports = [];
  const patterns = [
    /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(content))) imports.push(match[1]);
  }
  return imports;
}

function resolveRelativeImport(file, spec) {
  if (!spec.startsWith('.')) return null;
  return path.resolve(path.dirname(file), spec).split(path.sep).join('/');
}

function layerOfFile(fileRel) {
  const parts = fileRel.split('/');
  const layerSet = new Set(['domain', 'application', 'infrastructure', 'presentation', 'api', 'ui', 'adapters', 'delivery', 'use-cases']);
  return parts.find(p => layerSet.has(p)) ?? null;
}

function importContainsLayer(resolvedRel, layers) {
  if (!resolvedRel) return null;
  const parts = resolvedRel.split('/');
  return layers.find(layer => parts.includes(layer)) ?? null;
}

function validateDependencies(files, flavor) {
  const fail = [];
  const warn = [];
  const def = flavors[flavor] ?? flavors.strict;
  const domainForbiddenLayers = def.domainForbiddenLayers ?? flavors.strict.domainForbiddenLayers;
  const applicationForbiddenLayers = def.applicationForbiddenLayers ?? flavors.strict.applicationForbiddenLayers;

  for (const file of files) {
    const ext = path.extname(file);
    if (!sourceExtensions.has(ext)) continue;
    const fileRel = rel(file);
    const layer = layerOfFile(fileRel);
    if (!layer) continue;

    let content = '';
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const imports = parseImports(content);

    for (const spec of imports) {
      const resolved = resolveRelativeImport(file, spec);
      const resolvedRel = resolved ? path.relative(root, resolved).split(path.sep).join('/') : null;

      if (layer === 'domain') {
        const forbiddenLayer = importContainsLayer(resolvedRel, domainForbiddenLayers);
        if (forbiddenLayer) {
          fail.push({ file: fileRel, message: `domain imports ${forbiddenLayer}`, import: spec });
        }
        const forbiddenExternal = externalForbiddenInDomain.find(pkg => spec === pkg || spec.startsWith(pkg));
        if (forbiddenExternal) {
          fail.push({ file: fileRel, message: `domain imports external framework/adapter package '${forbiddenExternal}'`, import: spec });
        }
      }

      if (layer === 'application' || layer === 'use-cases') {
        const forbiddenLayer = importContainsLayer(resolvedRel, applicationForbiddenLayers);
        if (forbiddenLayer) {
          fail.push({ file: fileRel, message: `application imports ${forbiddenLayer}`, import: spec });
        }
        const infraLayer = importContainsLayer(resolvedRel, ['infrastructure', 'api', 'adapters']);
        if (infraLayer) {
          warn.push({ file: fileRel, message: `application imports concrete ${infraLayer}; prefer ports/interfaces`, import: spec });
        }
      }
    }
  }

  return { fail, warn };
}

function validateStructure(flavor) {
  const pass = [];
  const warn = [];
  const fail = [];

  const dddLike = detectDddLikeDirs();
  const projectKind = detectProjectKind();
  const detectedFlavor = inferFlavor(projectKind, dddLike);
  const effectiveFlavor = flavor === 'auto' ? (detectedFlavor === 'none' ? (projectKind === 'full-stack' ? 'fullstack-split' : 'strict') : detectedFlavor) : flavor;

  if (dddLike.length > 0) {
    pass.push(`Found ${dddLike.length} DDD-like module/feature director${dddLike.length === 1 ? 'y' : 'ies'}.`);
  } else {
    fail.push('No DDD-like module/feature directories found. Consider migrating before enforcing.');
  }

  const modules = findModulesForFlavor(effectiveFlavor);
  if (modules.length === 0) {
    warn.push(`No modules/features found for flavor '${effectiveFlavor}'. Expected one of: ${(flavors[effectiveFlavor]?.baseCandidates ?? []).join(', ') || 'configured base paths'}.`);
  } else {
    pass.push(`Found ${modules.length} module/feature director${modules.length === 1 ? 'y' : 'ies'} for flavor '${effectiveFlavor}'.`);
  }

  for (const mod of modules) {
    const children = new Set(listDirs(mod.path));
    const missing = mod.expectedLayers.filter(layer => !children.has(layer));
    const present = mod.expectedLayers.filter(layer => children.has(layer));
    if (present.length > 0) pass.push(`${rel(mod.path)} has layer(s): ${present.join(', ')}.`);
    if (missing.length > 0) warn.push(`${rel(mod.path)} is missing layer(s): ${missing.join(', ')}.`);

    if (['strict', 'backend-module', 'fullstack-split'].includes(effectiveFlavor)) {
      for (const layer of present) {
        const expectedInner = canonicalInnerFolders[layer] ?? [];
        if (expectedInner.length === 0) continue;
        const layerPath = path.join(mod.path, layer);
        const innerChildren = new Set(listDirs(layerPath));
        const missingInner = expectedInner.filter(name => !innerChildren.has(name));
        if (missingInner.length === 0) {
          pass.push(`${rel(layerPath)} has the recommended inner folder structure.`);
        } else {
          warn.push(`${rel(layerPath)} is missing recommended inner folder(s): ${missingInner.join(', ')}.`);
        }
      }
    }
  }

  const src = path.join(root, 'src');
  if (exists(src)) {
    const top = listDirs(src);
    const technical = top.filter(x => technicalTopFolders.includes(x));
    const hasBusinessContainer = top.includes('modules') || top.includes('features') || top.includes('domains');
    if (technical.length > 0 && !hasBusinessContainer) {
      warn.push(`src is organized by technical folders (${technical.join(', ')}) without modules/features/domains.`);
    } else if (hasBusinessContainer) {
      pass.push('src contains business-first container folder(s).');
    }
  }

  const shared = path.join(root, 'src', 'shared');
  if (exists(shared)) {
    const suspicious = [];
    for (const file of walk(shared)) {
      const name = path.basename(file, path.extname(file));
      if (/user|order|billing|invoice|product|cart|checkout|subscription|payment|account/i.test(name)) {
        suspicious.push(rel(file));
      }
    }
    if (suspicious.length > 0) {
      warn.push(`shared contains business-specific looking files: ${suspicious.slice(0, 10).join(', ')}${suspicious.length > 10 ? '...' : ''}`);
    } else {
      pass.push('shared folder did not show obvious business-specific file names.');
    }
  }

  const dependency = validateDependencies(walk(root), effectiveFlavor);
  for (const item of dependency.fail) fail.push(`${item.file}: ${item.message} via '${item.import}'.`);
  for (const item of dependency.warn) warn.push(`${item.file}: ${item.message} via '${item.import}'.`);

  const namingWarn = validateNaming(walk(root), modules);
  for (const item of namingWarn) warn.push(item);

  const recommendedAction = dddLike.length === 0 ? 'migrate' : (warn.length || fail.length ? 'enforce' : 'keep');

  return {
    root,
    requestedFlavor: flavor,
    detectedProjectType: projectKind,
    detectedFlavor,
    effectiveFlavor,
    canonicalTarget: 'src/modules/<context>/{domain,application,infrastructure,presentation}',
    recommendedAction,
    pass,
    warn,
    fail,
    dddLike: dddLike.map(x => ({ path: rel(x.path), layers: x.layers, strictScore: x.strictScore, frontendScore: x.frontendScore, customScore: x.customScore })).slice(0, 50)
  };
}

const report = validateStructure(requestedFlavor);

if (format === 'json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('DDD structure report');
  console.log('');
  console.log(`Detected project type: ${report.detectedProjectType}`);
  console.log(`Detected flavor: ${report.detectedFlavor}`);
  console.log(`Effective flavor: ${report.effectiveFlavor}`);
  console.log(`Canonical target: ${report.canonicalTarget}`);
  console.log(`Recommended action: ${report.recommendedAction}`);
  console.log('');
  console.log('Pass');
  for (const item of report.pass) console.log(`- ${item}`);
  if (report.pass.length === 0) console.log('- None');
  console.log('');
  console.log('Warn');
  for (const item of report.warn) console.log(`- ${item}`);
  if (report.warn.length === 0) console.log('- None');
  console.log('');
  console.log('Fail');
  for (const item of report.fail) console.log(`- ${item}`);
  if (report.fail.length === 0) console.log('- None');
}

if (report.fail.length > 0 || (failOnWarn && report.warn.length > 0)) {
  process.exitCode = 1;
}
