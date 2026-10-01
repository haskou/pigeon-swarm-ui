function compareUtf16(left: string, right: string): number {
  if (left === right) return 0;

  return left < right ? -1 : 1;
}

/**
 * RFC 8785 (JCS) canonical JSON for the value shapes public mutations commit
 * to: objects, arrays, strings, safe integers, booleans and null. The node
 * verifies digests with the same algorithm, so any divergence invalidates the
 * proof.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') return JSON.stringify(value);

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError('Canonical JSON supports safe integers only');
    }

    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareUtf16)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);

    return `{${members.join(',')}}`;
  }

  throw new TypeError('Value cannot be canonicalized');
}
