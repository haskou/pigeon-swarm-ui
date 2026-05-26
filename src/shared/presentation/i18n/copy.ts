import type { CopyOverrides } from './en';

import { enCopy } from './en';
import { esCopy } from './es';
import { getInitialLanguage } from './language';

export const copy = getInitialLanguage() === 'es' ? mergeCopy(enCopy, esCopy) : enCopy;

function mergeCopy<T extends Record<string, unknown>>(
  base: T,
  overrides: CopyOverrides<T>,
): T {
  const merged: Record<string, unknown> = { ...base };

  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const override = overrides[key];
    const baseValue = base[key];

    if (isRecord(baseValue) && isRecord(override)) {
      merged[key as string] = mergeCopy(
        baseValue,
        override as CopyOverrides<typeof baseValue>,
      );
    } else if (override !== undefined) {
      merged[key as string] = override;
    }
  }

  return merged as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
