#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const root = path.resolve(getArg('--root', process.cwd()));
const format = getArg('--format', 'markdown');
const skillRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const scanScript = path.join(skillRoot, 'scripts', 'scan-codebase-ddd.mjs');

function runScan() {
  const result = spawnSync(process.execPath, [scanScript, '--root', root, '--format', 'json'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `scan failed with status ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

function stableModules(scan) {
  return (scan.contexts || [])
    .filter(c => c.name && c.name !== 'uncategorized' && c.confidence !== 'low')
    .map(c => ({
      module: c.name,
      confidence: c.confidence,
      evidenceCount: c.evidenceCount,
      evidence: (c.evidence || []).slice(0, 12).sort(),
      symbols: (c.symbols || []).slice(0, 20).sort(),
      ubiquitousLanguageTerms: (c.ubiquitousLanguageTerms || []).slice(0, 25).sort(),
      reasons: (c.reasons || []).slice(0, 8).sort(),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

function layerPrompt(role, modules, scan) {
  const layer = role.toLowerCase();
  const scope = {
    domain: 'aggregate roots, aggregates, entities, value objects, domain services, events, repository ports, invariants, and misplaced domain logic',
    application: 'commands, queries, use cases, DTOs, application services, transaction boundaries, application ports, and misplaced orchestration',
    infrastructure: 'repository implementations, persistence, HTTP clients, SDK wrappers, queues, caches, email providers, mappers, and concrete adapters',
    presentation: 'controllers, routes, REST handlers, GraphQL resolvers, pages, components, hooks, stores, forms, view models, and request/response formatting',
  }[layer];
  return [
    `Role: DDD ${role} analyst.`,
    `Project root: ${root}`,
    `Project kind: ${scan.project?.kind || 'unknown'}`,
    'Work in read-only mode. Do not edit, move, rename, or create project files. Do not spawn subagents.',
    'Use the frozen module list below. Do not invent a different module list. New modules may be reported only as candidates.',
    `Analyze only: ${scope}.`,
    'Apply naming conventions in proposed paths: lowerCamelCase files, kebab-case folders, PascalCase classes/types, lowerCamelCase variables, and SCREAMING_SNAKE_CASE constants only when necessary.',
    'Prefer ubiquitous language from routes, UI, APIs, commands, events, tests, and workflows over generic implementation names.',
    'Return structured JSON matching assets/subagent-output-schema.json.',
    '',
    'Frozen module list:',
    JSON.stringify(modules, null, 2),
  ].join('\n');
}

const scan = runScan();
const modules = stableModules(scan);
const payload = {
  project: scan.project,
  modules,
  subagents: [
    { agent: 'ddd_domain_analyst', role: 'domain', prompt: layerPrompt('domain', modules, scan) },
    { agent: 'ddd_application_analyst', role: 'application', prompt: layerPrompt('application', modules, scan) },
    { agent: 'ddd_infrastructure_analyst', role: 'infrastructure', prompt: layerPrompt('infrastructure', modules, scan) },
    { agent: 'ddd_presentation_analyst', role: 'presentation', prompt: layerPrompt('presentation', modules, scan) },
  ],
};

if (format === 'json') {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log('# DDD Subagent Plan');
  console.log('');
  console.log(`Project kind: ${payload.project?.kind || 'unknown'}`);
  console.log('');
  console.log('## Frozen module list');
  if (!modules.length) {
    console.log('No medium/high confidence modules detected by the scan. The main agent must inspect routes, schemas, pages, controllers, tests, and business services manually before spawning subagents.');
  } else {
    for (const m of modules) {
      console.log(`- ${m.module} (${m.confidence}, ${m.evidenceCount} evidence files)`);
      for (const e of m.evidence.slice(0, 5)) console.log(`  - ${e}`);
    }
  }
  console.log('');
  console.log('## Subagent prompts');
  for (const s of payload.subagents) {
    console.log(`\n### ${s.agent}`);
    console.log('```text');
    console.log(s.prompt);
    console.log('```');
  }
}
