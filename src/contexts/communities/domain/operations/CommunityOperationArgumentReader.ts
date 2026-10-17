import { assert } from '@haskou/value-objects';

import { CommunityOperationRejectedError } from '../errors/CommunityOperationRejectedError';

/**
 * Reads the arguments of a signed operation: exactly the keys it is allowed
 * to carry, each of the type its rule names.
 */
export class CommunityOperationArgumentReader {
  public constructor(
    private readonly args: Readonly<Record<string, unknown>>,
    required: readonly string[],
    optional: readonly string[] = [],
  ) {
    const keys = Object.keys(args);

    assert(
      required.every((key) => keys.includes(key)) &&
        keys.every((key) => required.includes(key) || optional.includes(key)),
      new CommunityOperationRejectedError(),
    );
  }

  public string(key: string): string {
    const value = this.args[key];

    assert(typeof value === 'string', new CommunityOperationRejectedError());

    return value as string;
  }

  public optionalString(key: string): string | undefined {
    return this.args[key] === undefined ? undefined : this.string(key);
  }

  public integer(key: string): number {
    const value = this.args[key];

    assert(
      typeof value === 'number' && Number.isSafeInteger(value),
      new CommunityOperationRejectedError(),
    );

    return value as number;
  }
}
