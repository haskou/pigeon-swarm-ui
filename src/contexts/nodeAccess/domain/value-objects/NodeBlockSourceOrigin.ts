import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidNodeBlockSourceOriginError } from '../errors/InvalidNodeBlockSourceOriginError';

function originOf(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const isOrigin =
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.pathname === '/' || url.pathname === '') &&
      !url.search &&
      !url.hash;

    return isOrigin ? url.origin : null;
  } catch {
    return null;
  }
}

/** The https origin of the node whose published block list is followed. */
export class NodeBlockSourceOrigin extends StringValueObject {
  public static fromString(value: string): NodeBlockSourceOrigin {
    const origin = originOf(value);

    assert(origin !== null, new InvalidNodeBlockSourceOriginError());

    return new NodeBlockSourceOrigin(origin ?? '');
  }

  private constructor(value: string) {
    super(value);
  }
}
