#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootArgIndex = process.argv.indexOf('--root');
const root = path.resolve(rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : '.');
const modulesDir = path.join(root, 'src', 'modules');
const modules = [];
if (fs.existsSync(modulesDir)) {
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) modules.push(entry.name);
  }
}
const plan = {
  frozenModuleInventory: modules,
  subagents: [
    'ddd_domain_analyst',
    'ddd_application_analyst',
    'ddd_infrastructure_analyst',
    'ddd_presentation_analyst'
  ],
  instructions: 'Give every subagent the same frozenModuleInventory. Subagents must not invent new modules; they may propose module changes separately as recommendations.'
};
console.log(JSON.stringify(plan, null, 2));
