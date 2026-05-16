#!/usr/bin/env node
/*
Dependency-free helper for a first-pass DDD architecture scan.
It intentionally produces candidates, not final architectural truth.
Codex should inspect representative files manually after running it.
*/

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback = undefined) => {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const prefixed = args.find(a => a.startsWith(`${name}=`));
  if (prefixed) return prefixed.slice(name.length + 1);
  return fallback;
};

const root = path.resolve(getArg('--root', process.cwd()));
const format = getArg('--format', 'markdown');
const maxFiles = Number(getArg('--max-files', '5000'));

const ignoreDirs = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage', '.turbo', '.cache',
  '.agents', '.codex', 'vendor', 'target', 'bin', 'obj', '__pycache__', '.pytest_cache', '.venv', 'venv', 'tmp', 'temp', 'logs'
]);

const sourceExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.java', '.kt', '.cs', '.php', '.rs', '.swift', '.vue', '.svelte', '.graphql', '.gql', '.prisma'
]);

const configNames = new Set([
  'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.mjs',
  'nuxt.config.ts', 'angular.json', 'nest-cli.json', 'prisma.schema', 'schema.prisma', 'docker-compose.yml',
  'compose.yml', 'turbo.json', 'pnpm-workspace.yaml', 'yarn.lock', 'pnpm-lock.yaml', 'package-lock.json'
]);

const technicalBuckets = new Set([
  'src', 'app', 'apps', 'packages', 'package', 'lib', 'libs', 'common', 'shared', 'core', 'utils', 'utility',
  'utilities', 'helpers', 'services', 'service', 'components', 'component', 'hooks', 'hook', 'stores', 'store',
  'pages', 'page', 'routes', 'route', 'controllers', 'controller', 'models', 'model', 'schemas', 'schema',
  'dto', 'dtos', 'types', 'type', 'interfaces', 'interface', 'api', 'client', 'clients', 'server', 'infrastructure',
  'domain', 'application', 'presentation', 'adapters', 'adapter', 'repository', 'repositories', 'entities', 'entity',
  'value-objects', 'valueobjects', 'aggregates', 'aggregate', 'commands', 'queries', 'use-cases', 'usecases',
  'graphql', 'rest', 'http', 'prisma', 'postgres', 'redis', 'email', 'test', 'tests', '__tests__', 'spec', 'mocks'
]);

const contextHintDirs = new Set(['modules', 'features', 'domains', 'bounded-contexts', 'contexts']);
const genericModuleNames = new Set(['data', 'logic', 'service', 'services', 'model', 'models', 'manager', 'managers', 'helper', 'helpers', 'util', 'utils', 'common', 'shared', 'lib', 'core', 'base', 'misc']);
const allowedSpecialFolders = new Set(['__tests__', '__mocks__', '__fixtures__']);

function isKebabCase(name) {
  if (allowedSpecialFolders.has(name)) return true;
  if (/^\(.+\)$/.test(name) || /^\[.+\]$/.test(name)) return true;
  if (name.startsWith('.')) return true;
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name);
}

function isLowerCamelCase(name) {
  if (name === 'index') return true;
  if (/^\[.+\]$/.test(name)) return true;
  return /^[a-z][A-Za-z0-9]*$/.test(name);
}

function stripKnownFileSuffixes(base) {
  return base
    .replace(/\.d$/, '')
    .replace(/\.(test|spec|stories|story)$/i, '');
}


const categoryRules = [
  { key: 'aggregateRoots', label: 'Aggregate root candidates', test: f => hasAny(f, ['aggregate-root', 'aggregateroot']) || nameHas(f, ['AggregateRoot']) },
  { key: 'aggregates', label: 'Aggregate candidates', test: f => hasAny(f, ['aggregates', 'aggregate']) || nameHas(f, ['Aggregate']) },
  { key: 'entities', label: 'Entity candidates', test: f => hasAny(f, ['entities', 'entity', 'models', 'model']) || nameHas(f, ['Entity']) },
  { key: 'valueObjects', label: 'Value object candidates', test: f => hasAny(f, ['value-objects', 'valueobjects', 'value-object']) || nameHas(f, ['ValueObject', 'Money', 'Email', 'Address', 'DateRange', 'Quantity', 'Currency', 'Phone', 'Price', 'Slug']) },
  { key: 'domainServices', label: 'Domain service candidates', test: f => hasAny(f, ['domain-services', 'domain-service']) || nameHas(f, ['DomainService', 'Policy', 'Specification']) },
  { key: 'events', label: 'Domain event candidates', test: f => hasAny(f, ['events', 'event']) || nameHas(f, ['Event', 'Registered', 'Created', 'Updated', 'Deleted', 'Placed', 'Cancelled', 'Canceled', 'Paid', 'Captured']) },
  { key: 'repositoryPorts', label: 'Repository port candidates', test: f => (hasAny(f, ['domain/repositories', 'domain\\repositories', 'repositories']) && nameHas(f, ['Repository', 'Repo'])) || nameHas(f, ['RepositoryPort']) },
  { key: 'useCases', label: 'Use case candidates', test: f => hasAny(f, ['use-cases', 'usecases', 'application']) || nameHas(f, ['UseCase', 'Handler', 'CommandHandler', 'QueryHandler']) || startsWithVerb(baseNoExt(f)) },
  { key: 'commands', label: 'Command candidates', test: f => hasAny(f, ['commands']) || nameHas(f, ['Command']) },
  { key: 'queries', label: 'Query candidates', test: f => hasAny(f, ['queries']) || nameHas(f, ['Query']) },
  { key: 'dtos', label: 'DTO candidates', test: f => hasAny(f, ['dto', 'dtos']) || nameHas(f, ['Dto', 'DTO', 'Request', 'Response', 'Input', 'Output']) },
  { key: 'infrastructureAdapters', label: 'Infrastructure adapter candidates', test: f => hasAny(f, ['infrastructure', 'adapters', 'adapter', 'prisma', 'postgres', 'redis', 'email', 'http', 'api', 'client', 'clients', 'persistence', 'storage', 'queue']) || nameHas(f, ['Prisma', 'Postgres', 'Redis', 'Email', 'Http', 'Api', 'Client', 'Gateway', 'Adapter', 'Provider']) },
  { key: 'presentation', label: 'Presentation delivery candidates', test: f => hasAny(f, ['presentation', 'controllers', 'controller', 'routes', 'route', 'graphql', 'rest', 'pages', 'components', 'hooks', 'forms', 'view-models', 'viewmodels']) || nameHas(f, ['Controller', 'Resolver', 'Route', 'Page', 'Form', 'ViewModel']) },
];

const frameworkPackages = {
  frontend: ['react', 'next', 'vue', '@angular/core', 'svelte', '@sveltejs/kit', '@remix-run/react', 'solid-js'],
  backend: ['express', '@nestjs/core', 'fastify', 'hono', 'koa', '@apollo/server', 'graphql-yoga', '@prisma/client', 'typeorm', 'sequelize', 'mongoose'],
  testing: ['jest', 'vitest', 'mocha', 'playwright', 'cypress', '@testing-library/react'],
};

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function readFile(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function rel(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walk(dir, acc = []) {
  if (acc.length >= maxFiles) return acc;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (acc.length >= maxFiles) break;
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (sourceExtensions.has(path.extname(entry.name)) || configNames.has(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !ignoreDirs.has(d.name))
      .map(d => d.name)
      .sort();
  } catch {
    return [];
  }
}

function hasAny(fileRel, needles) {
  const s = fileRel.toLowerCase();
  return needles.some(n => s.includes(n.toLowerCase()));
}

function baseNoExt(fileRel) {
  return path.basename(fileRel, path.extname(fileRel));
}

function nameHas(fileRel, needles) {
  const b = baseNoExt(fileRel);
  return needles.some(n => b.includes(n));
}

function startsWithVerb(name) {
  return /^(create|get|list|update|delete|remove|add|register|login|logout|authenticate|authorize|place|cancel|pay|capture|refund|send|invite|assign|unassign|enable|disable|activate|deactivate|approve|reject|submit|publish|archive|restore|sync|import|export|calculate|validate)[A-Z_-]/.test(name);
}

function singularize(token) {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('ses') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

function normalizeContextName(raw) {
  return singularize(String(raw || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase()
    .replace(/^-+|-+$/g, ''));
}

function addMap(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function detectProjectKind(files) {
  const pkg = readJson(path.join(root, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const depNames = Object.keys(deps);
  const hasDep = name => depNames.includes(name);
  const frontendDeps = frameworkPackages.frontend.filter(hasDep);
  const backendDeps = frameworkPackages.backend.filter(hasDep);
  const testingDeps = frameworkPackages.testing.filter(hasDep);

  const hasApps = exists(path.join(root, 'apps')) || exists(path.join(root, 'packages'));
  const hasFrontendFiles = files.some(f => /\.(tsx|jsx|vue|svelte)$/.test(f) || /(^|\/)(pages|components|hooks|stores)(\/|$)/.test(rel(f)));
  const hasBackendFiles = files.some(f => /(^|\/)(controllers|routes|resolvers|server|api)(\/|$)/.test(rel(f)) || /schema\.prisma$/.test(f));

  let kind = 'unknown';
  if (hasApps || (frontendDeps.length && backendDeps.length) || (hasFrontendFiles && hasBackendFiles)) kind = 'full-stack';
  else if (frontendDeps.length || hasFrontendFiles) kind = 'frontend';
  else if (backendDeps.length || hasBackendFiles) kind = 'backend';

  return { kind, frontendDeps, backendDeps, testingDeps, packageManager: detectPackageManager() };
}

function detectPackageManager() {
  if (exists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (exists(path.join(root, 'package-lock.json'))) return 'npm';
  return 'unknown';
}

function extractSymbols(content) {
  const symbols = [];
  const patterns = [
    /(?:export\s+)?(?:abstract\s+)?class\s+([A-Z][A-Za-z0-9_]*)/g,
    /(?:export\s+)?interface\s+([A-Z][A-Za-z0-9_]*)/g,
    /(?:export\s+)?type\s+([A-Z][A-Za-z0-9_]*)/g,
    /(?:export\s+)?enum\s+([A-Z][A-Za-z0-9_]*)/g,
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    /(?:export\s+)?const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g,
    /^model\s+([A-Z][A-Za-z0-9_]*)\s+\{/gm,
    /^type\s+([A-Z][A-Za-z0-9_]*)\s+\{/gm,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content))) symbols.push(m[1]);
  }
  return [...new Set(symbols)].slice(0, 20);
}

function extractRouteHints(content) {
  const hints = [];
  const patterns = [
    /(?:router|app)\.(?:get|post|put|patch|delete)\(\s*['"`]\/([^'"`\/:)]+)/g,
    /(?:path|Path|Controller)\(\s*['"`]\/??([^'"`\/:)]+)/g,
    /(?:fetch|axios\.[a-z]+)\(\s*['"`]\/api\/([^'"`\/:)]+)/g,
    /href=\{?['"`]\/([^'"`\/:)]+)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content))) {
      const h = normalizeContextName(m[1]);
      if (h && !technicalBuckets.has(h)) hints.push(h);
    }
  }
  return hints;
}

function extractImports(content) {
  const imports = [];
  const patterns = [
    /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content))) imports.push(m[1]);
  }
  return imports;
}

function inferContextFromPath(fileRel) {
  const parts = fileRel.split('/').filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    if (contextHintDirs.has(parts[i])) {
      const candidate = normalizeContextName(parts[i + 1]);
      if (candidate && !technicalBuckets.has(candidate)) return { context: candidate, reason: `folder ${parts[i]}/${parts[i + 1]}` };
    }
  }

  const sourceStart = parts.includes('src') ? parts.indexOf('src') + 1 : 0;
  for (let i = sourceStart; i < Math.min(parts.length - 1, sourceStart + 4); i++) {
    const candidate = normalizeContextName(parts[i]);
    if (candidate && !technicalBuckets.has(candidate) && !/^\[.+\]$/.test(parts[i])) {
      return { context: candidate, reason: `path segment ${parts[i]}` };
    }
  }

  const base = baseNoExt(fileRel);
  const tokens = base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .split(/[-_.]/)
    .map(normalizeContextName)
    .filter(Boolean)
    .filter(t => !technicalBuckets.has(t));
  if (tokens.length) return { context: tokens[tokens.length - 1], reason: `file name ${base}` };

  return { context: 'uncategorized', reason: 'no clear context signal' };
}

function classifyFile(fileRel, content) {
  const categories = [];
  for (const rule of categoryRules) {
    if (rule.test(fileRel)) categories.push(rule.key);
  }

  const imports = extractImports(content);
  if (imports.some(i => /(@prisma|typeorm|sequelize|mongoose|pg|mysql2|sqlite3|redis|axios|got|ky|firebase|@supabase|aws-sdk|@aws-sdk)/.test(i))) {
    if (!categories.includes('infrastructureAdapters')) categories.push('infrastructureAdapters');
  }
  if (imports.some(i => /(react|next|vue|@angular|svelte|react-router|vue-router)/.test(i))) {
    if (!categories.includes('presentation')) categories.push('presentation');
  }
  if (/interface\s+[A-Z][A-Za-z0-9_]*Repository/.test(content) || /abstract\s+class\s+[A-Z][A-Za-z0-9_]*Repository/.test(content)) {
    if (!categories.includes('repositoryPorts')) categories.push('repositoryPorts');
  }
  if (/equals\s*\(|readonly\s+|Object\.freeze|private\s+constructor/.test(content) && nameHas(fileRel, ['Email','Money','Address','Date','Quantity','Currency','Price','Slug','Name','Id','ID'])) {
    if (!categories.includes('valueObjects')) categories.push('valueObjects');
  }

  return [...new Set(categories)];
}

function pushLimited(arr, item, limit = 20) {
  if (arr.length < limit && !arr.includes(item)) arr.push(item);
}

function analyze() {
  const files = walk(root);
  const project = detectProjectKind(files);
  const contexts = new Map();
  const routeHints = new Map();
  const misplaced = [];
  const technicalBucketFiles = [];
  const namingIssues = [];
  const ubiquitousLanguageTerms = new Map();
  const configFiles = files.filter(f => configNames.has(path.basename(f))).map(rel);

  for (const file of files) {
    const ext = path.extname(file);
    if (!sourceExtensions.has(ext)) continue;
    const fileRel = rel(file);
    const parsed = path.parse(fileRel);
    const cleanBase = stripKnownFileSuffixes(parsed.name);
    if (!isLowerCamelCase(cleanBase)) {
      pushLimited(namingIssues, `${fileRel}: file name should be lowerCamelCase`, 60);
    }
    for (const folder of fileRel.split('/').slice(0, -1)) {
      if (folder !== 'src' && !isKebabCase(folder) && !['apps', 'packages'].includes(folder)) {
        pushLimited(namingIssues, `${fileRel}: folder '${folder}' should be kebab-case`, 60);
      }
    }
    const content = readFile(file).slice(0, 200000);
    const pathContext = inferContextFromPath(fileRel);
    const routeContextHints = extractRouteHints(content);
    for (const hint of routeContextHints) addMap(routeHints, hint, fileRel);

    let contextName = pathContext.context;
    if (contextName === 'uncategorized' && routeContextHints[0]) contextName = routeContextHints[0];

    const symbols = extractSymbols(content);
    const categories = classifyFile(fileRel, content);
    for (const s of symbols) {
      if (/^[A-Z][A-Za-z0-9]+$/.test(s) && !technicalBuckets.has(normalizeContextName(s))) {
        addMap(ubiquitousLanguageTerms, contextName, s);
      }
    }
    const imports = extractImports(content);

    if (!contexts.has(contextName)) {
      contexts.set(contextName, {
        name: contextName,
        evidence: [],
        reasons: new Set(),
        symbols: new Set(),
        filesByCategory: Object.fromEntries(categoryRules.map(r => [r.key, []])),
        allFiles: [],
        imports: new Set(),
      });
    }
    const ctx = contexts.get(contextName);
    pushLimited(ctx.evidence, fileRel, 30);
    ctx.reasons.add(pathContext.reason);
    for (const s of symbols) ctx.symbols.add(s);
    for (const i of imports) ctx.imports.add(i);
    pushLimited(ctx.allFiles, fileRel, 50);
    for (const c of categories) pushLimited(ctx.filesByCategory[c], fileRel, 25);

    if (/domain\//.test(fileRel) && imports.some(i => /(react|next|vue|@angular|express|@nestjs|fastify|hono|@prisma|typeorm|sequelize|mongoose|axios|redis|firebase|@supabase|aws-sdk|@aws-sdk)/.test(i))) {
      misplaced.push({ file: fileRel, issue: 'Domain file imports framework, persistence, HTTP, browser, or external SDK dependency.' });
    }
    if (/application\//.test(fileRel) && imports.some(i => /(react|next|vue|@angular|express|@nestjs|fastify|hono)/.test(i))) {
      misplaced.push({ file: fileRel, issue: 'Application file appears to import presentation or transport framework dependency.' });
    }

    const parts = fileRel.split('/');
    if (parts.some(p => ['services', 'models', 'utils', 'helpers', 'lib', 'common', 'shared'].includes(p))) {
      pushLimited(technicalBucketFiles, fileRel, 40);
    }
  }

  for (const [hint, filesSet] of routeHints.entries()) {
    if (!contexts.has(hint)) {
      contexts.set(hint, {
        name: hint,
        evidence: [...filesSet].slice(0, 30),
        reasons: new Set(['route or API namespace']),
        symbols: new Set(),
        filesByCategory: Object.fromEntries(categoryRules.map(r => [r.key, []])),
        allFiles: [...filesSet].slice(0, 50),
        imports: new Set(),
      });
    }
  }

  const contextList = [...contexts.values()]
    .filter(ctx => ctx.name !== 'uncategorized' || ctx.allFiles.length > 0)
    .map(ctx => {
      const evidenceCount = ctx.allFiles.length;
      const categoryCount = Object.values(ctx.filesByCategory).filter(v => v.length).length;
      const confidence = evidenceCount >= 5 && categoryCount >= 3 ? 'high' : evidenceCount >= 2 || categoryCount >= 2 ? 'medium' : 'low';
      return {
        name: ctx.name,
        confidence,
        evidenceCount,
        reasons: [...ctx.reasons].slice(0, 8),
        evidence: ctx.evidence,
        symbols: [...ctx.symbols].slice(0, 25),
        ubiquitousLanguageTerms: [...(ubiquitousLanguageTerms.get(ctx.name) ?? [])].slice(0, 25),
        filesByCategory: ctx.filesByCategory,
      };
    })
    .sort((a, b) => {
      if (a.name === 'uncategorized') return 1;
      if (b.name === 'uncategorized') return -1;
      return b.evidenceCount - a.evidenceCount || a.name.localeCompare(b.name);
    });

  return {
    root,
    scannedFiles: files.length,
    project,
    configFiles,
    contexts: contextList,
    technicalBucketFiles,
    namingIssues,
    misplaced,
    proposedStrictTree: buildProposedTree(contextList),
  };
}

function buildProposedTree(contexts) {
  const selected = contexts.filter(c => c.name !== 'uncategorized' && c.confidence !== 'low').slice(0, 20);
  return selected.map(c => ({
    context: c.name,
    tree: [
      `src/modules/${c.name}/domain/entities/`,
      `src/modules/${c.name}/domain/value-objects/`,
      `src/modules/${c.name}/domain/aggregates/`,
      `src/modules/${c.name}/domain/domain-services/`,
      `src/modules/${c.name}/domain/events/`,
      `src/modules/${c.name}/domain/repositories/`,
      `src/modules/${c.name}/application/commands/`,
      `src/modules/${c.name}/application/queries/`,
      `src/modules/${c.name}/application/use-cases/`,
      `src/modules/${c.name}/application/dto/`,
      `src/modules/${c.name}/infrastructure/http/`,
      `src/modules/${c.name}/presentation/`,
    ]
  }));
}

function printMarkdown(result) {
  console.log('# DDD Codebase Scan');
  console.log('');
  console.log(`Root: \`${result.root}\``);
  console.log(`Scanned files: ${result.scannedFiles}`);
  console.log(`Project kind: ${result.project.kind}`);
  if (result.project.frontendDeps.length) console.log(`Frontend deps: ${result.project.frontendDeps.join(', ')}`);
  if (result.project.backendDeps.length) console.log(`Backend deps: ${result.project.backendDeps.join(', ')}`);
  if (result.project.testingDeps.length) console.log(`Testing deps: ${result.project.testingDeps.join(', ')}`);
  if (result.project.packageManager !== 'unknown') console.log(`Package manager: ${result.project.packageManager}`);
  console.log('');

  if (result.configFiles.length) {
    console.log('## Config and schema files');
    for (const f of result.configFiles.slice(0, 30)) console.log(`- ${f}`);
    console.log('');
  }

  console.log('## Candidate bounded contexts');
  if (!result.contexts.length) console.log('No clear context candidates detected. Inspect routes, database schemas, UI flows, and business services manually.');
  for (const ctx of result.contexts) {
    console.log(`\n### ${ctx.name} (${ctx.confidence} confidence)`);
    console.log(`Evidence files: ${ctx.evidenceCount}`);
    if (ctx.reasons.length) console.log(`Signals: ${ctx.reasons.join('; ')}`);
    if (ctx.symbols.length) console.log(`Symbols: ${ctx.symbols.slice(0, 15).join(', ')}`);
    if (ctx.ubiquitousLanguageTerms?.length) console.log(`Ubiquitous language candidates: ${ctx.ubiquitousLanguageTerms.slice(0, 15).join(', ')}`);
    console.log('Evidence:');
    for (const f of ctx.evidence.slice(0, 10)) console.log(`- ${f}`);

    for (const rule of categoryRules) {
      const files = ctx.filesByCategory[rule.key] || [];
      if (!files.length) continue;
      console.log(`\n${rule.label}:`);
      for (const f of files.slice(0, 8)) console.log(`- ${f}`);
    }
  }

  if (result.namingIssues.length) {
    console.log('\n## Naming convention issues');
    for (const item of result.namingIssues.slice(0, 40)) console.log(`- ${item}`);
  }

  if (result.misplaced.length) {
    console.log('\n## Potential misplaced responsibilities');
    for (const item of result.misplaced.slice(0, 30)) console.log(`- ${item.file}: ${item.issue}`);
  }

  if (result.technicalBucketFiles.length) {
    console.log('\n## Technical bucket files to inspect manually');
    console.log('These may hide domain behavior, application orchestration, or infrastructure adapters.');
    for (const f of result.technicalBucketFiles.slice(0, 30)) console.log(`- ${f}`);
  }

  if (result.proposedStrictTree.length) {
    console.log('\n## Proposed strict DDD module roots');
    console.log('Use these as candidates, then refine after manual inspection.');
    console.log('');
    console.log('```text');
    console.log('src/');
    console.log('  modules/');
    for (const item of result.proposedStrictTree) {
      console.log(`    ${item.context}/`);
      console.log('      domain/');
      console.log('        entities/');
      console.log('        value-objects/');
      console.log('        aggregates/');
      console.log('        domain-services/');
      console.log('        events/');
      console.log('        repositories/');
      console.log('      application/');
      console.log('        commands/');
      console.log('        queries/');
      console.log('        use-cases/');
      console.log('        dto/');
      console.log('      infrastructure/');
      console.log('        http/');
      console.log('      presentation/');
    }
    console.log('```');
  }
}

const result = analyze();
if (format === 'json') {
  console.log(JSON.stringify(result, null, 2));
} else {
  printMarkdown(result);
}
