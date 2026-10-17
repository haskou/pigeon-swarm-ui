import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * The node serves resources and methods only. Every verb-style path it removed
 * must stay out of the client and the browser specs, or a request would reach
 * an unrelated resource route instead of the operation it names.
 */
const removedPaths: [string, RegExp][] = [
  ['POST /communities/{id}/channels/text', /\/channels\/text\b/],
  ['POST /communities/{id}/channels/voice', /\/channels\/voice\b/],
  ['DELETE /communities/{id}/members/{identityId}/kick', /\/kick(?![-\w])/],
  ['GET /communities/discover', /\/communities\/discover\b/],
  ['POST /polls/{pollId}/close', /\/polls\/.*\/close\b/],
  [
    'POST /calls/{id}/participants/me/heartbeat',
    /\/participants\/me\/heartbeat/,
  ],
  ['GET /calls/history', /\/calls\/history\b/],
  ['GET /calls/ice-servers', /\/calls\/ice-servers\b/],
  ['POST /stickers/packs/{p}/stickers/{s}/used', /\/stickers\/.*\/used\b/],
  ['POST /node/networks/public', /\/node\/networks\/public\b/],
  ['POST /ipfs/public', /\/ipfs\/public\b/],
];
const roots = ['src', 'e2e'].map((root) => path.join(process.cwd(), root));
const thisFile = path.join(
  process.cwd(),
  'src/test/shared/infrastructure/http/RemovedVerbEndpoints.spec.ts',
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(fullPath);

    return /\.tsx?$/.test(entry.name) && fullPath !== thisFile
      ? [fullPath]
      : [];
  });
}

describe('removed verb-style endpoints', () => {
  const files = roots.flatMap(sourceFiles);

  it.each(removedPaths)('never requests %s', (_operation, pattern) => {
    const offenders = files
      .filter((file) => pattern.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
