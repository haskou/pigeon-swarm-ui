#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORES = new Set([
  'node_modules', '.git', '.next', '.svelte-kit', '.agents', '.codex', 'dist', 'build', 'coverage', '.turbo', '.cache', 'vendor', 'target', 'out'
]);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.svelte', '.vue']);
const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { root: '.', format: 'markdown', largeFileLines: 250, largeFileBytes: 20000 };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--root') opts.root = args[++i] || opts.root;
    else if (arg === '--format') opts.format = args[++i] || opts.format;
    else if (arg === '--large-file-lines') opts.largeFileLines = Number(args[++i] || opts.largeFileLines);
    else if (arg === '--large-file-bytes') opts.largeFileBytes = Number(args[++i] || opts.largeFileBytes);
  }
  opts.root = path.resolve(opts.root);
  return opts;
}

function walk(dir, root, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (DEFAULT_IGNORES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, out);
    else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SOURCE_EXTENSIONS.has(ext)) out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return out;
}

function read(root, rel) {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
}

function lineCount(text) { return text.length ? text.split(/\r?\n/).length : 0; }
function byteCount(text) { return Buffer.byteLength(text, 'utf8'); }
function isKebab(s) { return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(s); }
function isLowerCamel(s) { return /^[a-z][a-z0-9]*(?:[A-Z][a-zA-Z0-9]*)*$/.test(s); }
function isPascal(s) { return /^[A-Z][a-zA-Z0-9]*$/.test(s); }
function isScreamingSnake(s) { return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(s); }

function stripExtensionParts(file) {
  return file
    .replace(/\.server\.(ts|tsx|js|jsx|mts|cts|mjs|cjs|svelte|vue)$/i, '')
    .replace(/\.(types|constants|helpers|test|spec)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/i, '')
    .replace(/\.(ts|tsx|js|jsx|mts|cts|mjs|cjs|svelte|vue)$/i, '');
}

function detectExports(text) {
  const exportedClasses = [...text.matchAll(/\bexport\s+(?:abstract\s+)?class\s+([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1]);
  const exportedInterfaces = [...text.matchAll(/\bexport\s+interface\s+([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1]);
  const exportedTypes = [...text.matchAll(/\bexport\s+type\s+([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1]);
  const exportedEnums = [...text.matchAll(/\bexport\s+enum\s+([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1]);
  const exportedFunctions = [...text.matchAll(/\bexport\s+(?:async\s+)?function\s+([a-zA-Z_][A-Za-z0-9_]*)/g)].map(m => m[1]);
  const exportedConsts = [...text.matchAll(/\bexport\s+const\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]);
  const exportedConstFunctions = [...text.matchAll(/\bexport\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_][A-Za-z0-9_]*)\s*=>/g)].map(m => m[1]);
  return { exportedClasses, exportedInterfaces, exportedTypes, exportedEnums, exportedFunctions, exportedConsts, exportedConstFunctions };
}

function detectDependencyInstantiation(text) {
  const issues = [];
  const propertyNews = [...text.matchAll(/(?:private|protected|public)\s+(?:readonly\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*new\s+([A-Z][A-Za-z0-9_]*)\s*\(/g)];
  for (const m of propertyNews) issues.push(`property initializer instantiates ${m[1]}`);
  const propertyFactories = [...text.matchAll(/(?:private|protected|public)\s+(?:readonly\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(create[A-Z][A-Za-z0-9_]*)\s*\(/g)];
  for (const m of propertyFactories) issues.push(`property initializer calls factory ${m[1]}`);
  const constructorBlocks = [...text.matchAll(/constructor\s*\([^)]*\)\s*{([\s\S]*?)^\s*}/gm)];
  for (const m of constructorBlocks) {
    const block = m[1] || '';
    for (const n of block.matchAll(/new\s+([A-Z][A-Za-z0-9_]*)\s*\(/g)) issues.push(`constructor instantiates ${n[1]}`);
    for (const f of block.matchAll(/(create[A-Z][A-Za-z0-9_]*)\s*\(/g)) issues.push(`constructor calls factory ${f[1]}`);
  }
  return issues;
}

function hasConstructor(text) { return /\bconstructor\s*\(/.test(text); }
function hasClass(text) { return /\bexport\s+(?:abstract\s+)?class\s+/.test(text) || /\bclass\s+[A-Z]/.test(text); }

function layerOf(rel) {
  const parts = rel.split('/');
  const idx = parts.indexOf('modules');
  if (idx >= 0 && parts.length > idx + 2) {
    const layer = parts[idx + 2];
    if (['domain', 'application', 'infrastructure', 'presentation'].includes(layer)) return layer;
  }
  for (const layer of ['domain', 'application', 'infrastructure', 'presentation']) {
    if (parts.includes(layer)) return layer;
  }
  return '';
}

function moduleOf(rel) {
  const parts = rel.split('/');
  const idx = parts.indexOf('modules');
  if (idx >= 0 && parts.length > idx + 1) return parts[idx + 1];
  const fidx = parts.indexOf('features');
  if (fidx >= 0 && parts.length > fidx + 1) return parts[fidx + 1];
  return '';
}

function isCompositionRoot(rel) {
  return /(^|\/)(container|composition-root|composition|di|dependencies)\//.test(rel)
    || /(^|\/)(container|compositionRoot|composition-root|di|dependencies)\.(ts|js|mts|mjs)$/.test(rel);
}

function folderGroups(files) {
  const map = new Map();
  for (const rel of files) {
    const dir = path.posix.dirname(rel);
    const base = path.posix.basename(rel);
    if (!map.has(dir)) map.set(dir, []);
    map.get(dir).push(base);
  }
  for (const v of map.values()) v.sort();
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function analyzeFiles(opts) {
  const files = walk(opts.root, opts.root);
  const issues = [];
  const modules = new Map();

  for (const rel of files) {
    const text = read(opts.root, rel);
    const lines = lineCount(text);
    const bytes = byteCount(text);
    const ext = path.extname(rel);
    const base = path.posix.basename(rel);
    const dirParts = path.posix.dirname(rel).split('/').filter(Boolean);
    const layer = layerOf(rel);
    const moduleName = moduleOf(rel);
    if (moduleName) {
      if (!modules.has(moduleName)) modules.set(moduleName, { name: moduleName, files: 0, layers: new Set() });
      modules.get(moduleName).files++;
      if (layer) modules.get(moduleName).layers.add(layer);
    }

    for (const folder of dirParts) {
      if (!folder.startsWith('.') && !isKebab(folder) && !['src'].includes(folder)) {
        issues.push({ severity: 'warning', rule: 'folder-kebab-case', path: rel, message: `Folder "${folder}" should be kebab-case.` });
      }
    }

    const stem = stripExtensionParts(base);
    if (base !== 'index.ts' && base !== 'index.js' && base !== 'index.mjs' && base !== 'index.cjs' && !isLowerCamel(stem)) {
      issues.push({ severity: 'warning', rule: 'file-lower-camel-case', path: rel, message: `File stem "${stem}" should be lowerCamelCase.` });
    }

    const ex = detectExports(text);
    for (const name of [...ex.exportedClasses, ...ex.exportedInterfaces, ...ex.exportedTypes, ...ex.exportedEnums]) {
      if (!isPascal(name)) issues.push({ severity: 'warning', rule: 'pascal-case-type', path: rel, symbol: name, message: `Type/class "${name}" should be PascalCase.` });
    }
    for (const name of ex.exportedConsts) {
      if (name === name.toUpperCase() && !isScreamingSnake(name)) {
        issues.push({ severity: 'warning', rule: 'constant-screaming-snake-case', path: rel, symbol: name, message: `Constant "${name}" appears uppercase but is not SCREAMING_SNAKE_CASE.` });
      }
    }

    if (lines > opts.largeFileLines || bytes > opts.largeFileBytes) {
      issues.push({ severity: 'warning', rule: 'large-file', path: rel, message: `File has ${lines} lines and ${bytes} bytes. Consider decomposition folder pattern if it has mixed responsibilities.` });
    }

    const isTypesFile = /\.types\.(ts|tsx|mts|cts)$/.test(base);
    const isConstantsFile = /\.constants\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(base);
    const isHelpersFile = /\.helpers\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(base);
    const typeCount = ex.exportedInterfaces.length + ex.exportedTypes.length + ex.exportedEnums.length;
    const constNames = ex.exportedConsts.filter(name => !ex.exportedConstFunctions.includes(name));
    const constCount = constNames.length;

    if (!isTypesFile && typeCount >= 2 && (ex.exportedClasses.length > 0 || ex.exportedFunctions.length > 0 || constCount > 0 || lines > 120)) {
      issues.push({ severity: 'warning', rule: 'extract-types', path: rel, message: `File exports ${typeCount} types/interfaces/enums. Move public types to <concept>.types.ts if they are not private implementation details.` });
    }

    if (!isConstantsFile && constCount >= 2 && (ex.exportedClasses.length > 0 || ex.exportedFunctions.length > 0 || typeCount > 0 || lines > 120)) {
      issues.push({ severity: 'warning', rule: 'extract-constants', path: rel, message: `File exports ${constCount} constants. Move public constants to <concept>.constants.ts if they are not private implementation details.` });
    }

    if (ex.exportedClasses.length > 1) {
      issues.push({ severity: 'error', rule: 'multiple-exported-classes', path: rel, message: `File exports ${ex.exportedClasses.length} classes (${ex.exportedClasses.join(', ')}). Split by responsibility; prefer one public class per implementation file.` });
    }

    const proceduralExports = [...ex.exportedFunctions, ...ex.exportedConstFunctions];
    if (['domain', 'application'].includes(layer) && proceduralExports.length > 0 && !isHelpersFile && !/\.test\.|\.spec\./.test(base)) {
      issues.push({ severity: 'warning', rule: 'procedural-domain-application', path: rel, message: `Domain/application file exports functions (${proceduralExports.join(', ')}). If these represent behavior or use cases, convert to OO classes with constructor injection.` });
    }

    const importTargets = [...text.matchAll(/(?:import[^'"]*from\s*|require\()\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
    if (layer === 'domain') {
      const bad = importTargets.filter(t => /(^|\/)(infrastructure|presentation)(\/|$)/.test(t) || /(@prisma|sequelize|typeorm|mongoose|redis|axios|fetch|react|svelte|vue|express|fastify|next\/|\.server$)/.test(t));
      if (bad.length) issues.push({ severity: 'error', rule: 'domain-dependency-purity', path: rel, message: `Domain code imports external/infrastructure/presentation concerns: ${bad.join(', ')}.` });
    }
    if (layer === 'application') {
      const bad = importTargets.filter(t => /(^|\/)infrastructure(\/|$)/.test(t) || /(@prisma|sequelize|typeorm|mongoose|redis)/.test(t));
      if (bad.length) issues.push({ severity: 'error', rule: 'application-dependency-purity', path: rel, message: `Application code imports concrete infrastructure concerns: ${bad.join(', ')}.` });
    }

    const di = detectDependencyInstantiation(text);
    if (['domain', 'application'].includes(layer) && di.length && !isCompositionRoot(rel)) {
      issues.push({ severity: 'error', rule: 'direct-dependency-instantiation', path: rel, message: `Class appears to instantiate dependencies directly: ${di.join('; ')}. Inject dependencies through constructor and move wiring to composition root.` });
    }

    if (['domain', 'application'].includes(layer) && hasClass(text) && /private\s+readonly\s+[A-Za-z_][A-Za-z0-9_]*\s*[:=]/.test(text) && !hasConstructor(text)) {
      issues.push({ severity: 'warning', rule: 'missing-constructor-injection', path: rel, message: `Class has private readonly fields but no constructor. Verify dependencies are injected rather than initialized internally.` });
    }
  }

  for (const [dir, names] of folderGroups(files)) {
    const indexNames = names.filter(n => /^index\.(ts|js|mjs|cjs)$/.test(n));
    if (!indexNames.length) continue;
    const sourceNames = names.filter(n => SOURCE_EXTENSIONS.has(path.extname(n)) && !/^index\./.test(n));
    const companionNames = sourceNames.filter(n => /\.(types|constants|helpers)\./.test(n));
    if (sourceNames.length === 1 && companionNames.length === 0) {
      const rel = `${dir}/${indexNames[0]}`.replace(/^\.\//, '');
      issues.push({ severity: 'warning', rule: 'useless-one-file-folder-index', path: rel, message: `Folder contains index plus one implementation file (${sourceNames[0]}). Remove the wrapper or remove index.ts unless this is a deliberate public boundary.` });
    }
  }

  const moduleList = [...modules.values()].map(m => ({ name: m.name, files: m.files, layers: [...m.layers].sort() })).sort((a,b)=>a.name.localeCompare(b.name));

  const modulesPath = path.join(opts.root, 'src', 'modules');
  if (!fs.existsSync(modulesPath)) {
    issues.push({ severity: 'warning', rule: 'strict-modules-root-missing', path: 'src/modules', message: 'Strict DDD root src/modules was not found. Use this as the default canonical structure unless a different flavor was selected.' });
  } else {
    for (const m of moduleList) {
      for (const layerName of ['domain', 'application', 'infrastructure', 'presentation']) {
        const layerPath = path.join(modulesPath, m.name, layerName);
        if (!fs.existsSync(layerPath)) issues.push({ severity: 'warning', rule: 'missing-ddd-layer', path: `src/modules/${m.name}/${layerName}`, message: `Module "${m.name}" is missing ${layerName}/.` });
      }
    }
  }

  return { files, modules: moduleList, issues: issues.sort((a,b)=> `${a.severity}:${a.path}:${a.rule}`.localeCompare(`${b.severity}:${b.path}:${b.rule}`)) };
}

function output(result, format, title='DDD analysis') {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`# ${title}`);
  console.log('');
  console.log(`Files scanned: ${result.files.length}`);
  console.log('');
  console.log('## Modules');
  if (!result.modules.length) console.log('- No modules detected.');
  for (const m of result.modules) console.log(`- ${m.name}: ${m.files} files; layers: ${m.layers.join(', ') || 'none detected'}`);
  console.log('');
  console.log('## Issues');
  if (!result.issues.length) console.log('- No issues detected by static scan.');
  for (const issue of result.issues) {
    const symbol = issue.symbol ? ` (${issue.symbol})` : '';
    console.log(`- [${issue.severity}] ${issue.rule}: ${issue.path}${symbol} - ${issue.message}`);
  }
}

const opts = parseArgs();
const result = analyzeFiles(opts);
output(result, opts.format, 'DDD structure validation');
