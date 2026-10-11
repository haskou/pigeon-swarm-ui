import { Buffer } from 'buffer';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';

const SRC = join(__dirname, '..', '..', '..', '..');
const HELPER = join(
  SRC,
  'shared',
  'infrastructure',
  'encoding',
  'base64url.ts',
);

const sourceFiles = (dir: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (path !== join(SRC, 'test')) {
        files.push(...sourceFiles(path));
      }
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
};

describe('base64url', () => {
  it('matches the node base64url encoding, including padding and + / bytes', () => {
    for (const length of [0, 1, 2, 3, 4, 31, 32, 33]) {
      const bytes = Uint8Array.from(
        { length },
        (_, index) => (index * 37 + 251) % 256,
      );

      expect(encodeBase64Url(bytes)).toBe(
        Buffer.from(bytes).toString('base64url'),
      );
    }
  });

  it('decodes what it encodes', () => {
    const bytes = Uint8Array.from([251, 255, 191, 0, 1, 2, 3]);

    expect(Array.from(decodeBase64Url(encodeBase64Url(bytes)))).toEqual(
      Array.from(bytes),
    );
  });

  it('is the only production code that uses the base64url encoding name', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== HELPER)
      .filter((file) => /['"]base64url['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
