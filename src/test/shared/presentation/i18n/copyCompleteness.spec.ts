import { en } from '../../../../shared/presentation/i18n/en';
import { es } from '../../../../shared/presentation/i18n/es';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function missingPaths(
  source: Record<string, unknown>,
  target: Record<string, unknown> | undefined,
  prefix = '',
): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const targetValue = target?.[key];

    if (isRecord(value)) {
      return missingPaths(
        value,
        isRecord(targetValue) ? targetValue : undefined,
        path,
      );
    }

    return typeof targetValue === 'string' ? [] : [path];
  });
}

describe('i18n copy completeness', () => {
  it('translates every English copy entry to Spanish', () => {
    expect(missingPaths(en, es)).toEqual([]);
  });

  it('does not keep Spanish entries without an English source', () => {
    expect(missingPaths(es, en)).toEqual([]);
  });
});
