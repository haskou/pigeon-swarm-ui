#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback = undefined) => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
};

const root = path.resolve(getArg('--root', '.'));
const maxDepth = Number(getArg('--max-depth', '5'));

const ignore = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage',
  'out', 'target', 'bin', 'obj', '.turbo', '.cache', 'vendor', '__pycache__'
]);

const layerNames = new Set([
  'domain', 'application', 'infrastructure', 'presentation', 'api', 'ui', 'controllers',
  'routes', 'resolvers', 'components', 'hooks', 'stores', 'services', 'models',
  'repositories', 'entities', 'value-objects', 'schemas'
]);

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

function walkDirs(dir, depth = 0, acc = []) {
  if (depth > maxDepth) return acc;
  for (const name of listDirs(dir)) {
    const full = path.join(dir, name);
    acc.push(full);
    walkDirs(full, depth + 1, acc);
  }
  return acc;
}

function detectFrameworks() {
  const pkg = readJson(path.join(root, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const names = Object.keys(deps);
  const has = n => names.includes(n);
  const contains = part => names.some(n => n.includes(part));
  const frameworks = [];

  if (has('next')) frameworks.push('Next.js');
  if (has('react')) frameworks.push('React');
  if (has('vue')) frameworks.push('Vue');
  if (has('@angular/core')) frameworks.push('Angular');
  if (has('svelte')) frameworks.push('Svelte');
  if (has('@remix-run/react')) frameworks.push('Remix');
  if (has('express')) frameworks.push('Express');
  if (has('@nestjs/core')) frameworks.push('NestJS');
  if (has('fastify')) frameworks.push('Fastify');
  if (has('hono')) frameworks.push('Hono');
  if (has('@prisma/client') || has('prisma')) frameworks.push('Prisma');
  if (has('typeorm')) frameworks.push('TypeORM');
  if (has('sequelize')) frameworks.push('Sequelize');
  if (has('mongoose')) frameworks.push('Mongoose');
  if (contains('graphql')) frameworks.push('GraphQL');

  return { pkg, frameworks, dependencies: names };
}

function detectProjectKind(info) {
  const fw = new Set(info.frameworks);
  const hasFrontend = ['Next.js', 'React', 'Vue', 'Angular', 'Svelte', 'Remix'].some(x => fw.has(x)) || exists(path.join(root, 'src', 'components')) || exists(path.join(root, 'src', 'pages')) || exists(path.join(root, 'src', 'app'));
  const hasBackend = ['Express', 'NestJS', 'Fastify', 'Hono', 'Prisma', 'TypeORM', 'Sequelize', 'Mongoose', 'GraphQL'].some(x => fw.has(x)) || exists(path.join(root, 'src', 'controllers')) || exists(path.join(root, 'src', 'routes')) || exists(path.join(root, 'server'));
  if (exists(path.join(root, 'apps')) || (hasFrontend && hasBackend)) return 'full-stack';
  if (hasFrontend) return 'frontend';
  if (hasBackend) return 'backend';
  return 'unknown';
}

function inspectCandidateBases() {
  const bases = [
    'src/modules', 'src/features', 'src/domains', 'src/app', 'src',
    'apps/web/src/modules', 'apps/api/src/modules',
    'apps/frontend/src/modules', 'apps/backend/src/modules',
    'apps/web/src/features', 'apps/api/src/modules', 'packages'
  ];

  const result = [];
  for (const rel of bases) {
    const full = path.join(root, rel);
    if (!exists(full)) continue;
    const children = listDirs(full);
    const candidateChildren = children.filter(name => !layerNames.has(name));
    const layerChildren = children.filter(name => layerNames.has(name));
    result.push({ path: rel, children, candidateChildren, layerChildren });
  }
  return result;
}

function inspectExistingDdd() {
  const dirs = walkDirs(root, 0, []);
  const matches = [];
  for (const dir of dirs) {
    const children = new Set(listDirs(dir));
    const strictScore = ['domain', 'application', 'infrastructure', 'presentation'].filter(x => children.has(x)).length;
    const frontendScore = ['domain', 'application', 'api', 'ui'].filter(x => children.has(x)).length;
    if (strictScore >= 2 || frontendScore >= 2) {
      matches.push({ path: path.relative(root, dir) || '.', strictScore, frontendScore, layers: [...children].filter(x => layerNames.has(x)).sort() });
    }
  }
  return matches.slice(0, 30);
}

function suggestFlavor(kind, existing) {
  if (existing.some(x => x.frontendScore >= 3)) return 'frontend-feature';
  if (existing.some(x => x.strictScore >= 3)) return 'strict';
  if (kind === 'full-stack') return 'fullstack-split';
  return 'strict';
}

const info = detectFrameworks();
const kind = detectProjectKind(info);
const candidateBases = inspectCandidateBases();
const existingDddLike = inspectExistingDdd();
const suggestedFlavor = suggestFlavor(kind, existingDddLike);

const report = {
  root,
  kind,
  frameworks: info.frameworks,
  packageScripts: info.pkg?.scripts ?? {},
  candidateBases,
  existingDddLike,
  suggestedFlavor,
  notes: [
    'Use this report as a starting point only. Read the code before moving files.',
    'Ask the user to choose a flavor if they have not already selected one.',
    'The preferred default for both frontend and backend is strict: src/modules/<context>/{domain,application,infrastructure,presentation}.',
    'Prefer business-first modules over technical folders.',
    'Apply naming conventions: files lowerCamelCase, folders kebab-case, classes/types PascalCase, variables lowerCamelCase, constants SCREAMING_SNAKE_CASE when necessary.',
    'Use ubiquitous language from routes, UI, APIs, events, commands, tests, and workflows as the source of truth for names.'
  ]
};

console.log(JSON.stringify(report, null, 2));
