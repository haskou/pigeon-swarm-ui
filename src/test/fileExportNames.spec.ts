import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const sourceRoot = path.join(process.cwd(), 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);
const publicExportPatterns = [
  /export\s+(?:abstract\s+)?class\s+([A-Z][A-Za-z0-9_]*)/g,
  /export\s+interface\s+([A-Z][A-Za-z0-9_]*)/g,
  /export\s+type\s+([A-Z][A-Za-z0-9_]*)/g,
  /export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/g,
  /export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g,
];

function sourceFiles(directory: string = sourceRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(fullPath);

    if (!sourceExtensions.has(path.extname(entry.name))) return [];

    return [fullPath];
  });
}

function publicExports(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const exports = publicExportPatterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1]),
  );

  return [...new Set(exports)];
}

function fileStem(filePath: string): string {
  return path.basename(filePath).replace(/\.tsx?$/, '');
}

function relative(filePath: string): string {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

describe('file export names', () => {
  it('matches each single public export with its file name exactly', () => {
    const mismatches = sourceFiles()
      .filter(
        (filePath) =>
          !filePath.endsWith('.d.ts') && !filePath.endsWith('.spec.ts'),
      )
      .flatMap((filePath) => {
        const exports = publicExports(filePath);

        if (exports.length !== 1 || fileStem(filePath) === exports[0]) {
          return [];
        }

        return [`${relative(filePath)} exports ${exports[0]}`];
      });

    expect(mismatches).toEqual([]);
  });

  it('keeps spec filenames aligned with the source under test', () => {
    const orphanSpecs = sourceFiles()
      .filter((filePath) => filePath.endsWith('.spec.ts'))
      .filter((filePath) => !relative(filePath).startsWith('src/test/'))
      .filter((filePath) => {
        const sourcePath = filePath.replace(/\.spec\.ts$/, '.ts');
        const tsxSourcePath = filePath.replace(/\.spec\.ts$/, '.tsx');

        return !existsSync(sourcePath) && !existsSync(tsxSourcePath);
      })
      .map(relative);

    expect(orphanSpecs).toEqual([]);
  });
});
