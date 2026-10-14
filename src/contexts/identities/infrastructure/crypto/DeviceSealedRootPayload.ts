import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceSealedRoots } from './DeviceSealedRoots';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';

/**
 * The clear text of a device sealed root entry: the root, and after a revoke
 * or a hand-over from a device that forgot itself, the root it replaced, as
 * `<root>[.<previous>]` in base64url. The previous root is one the recipients
 * already held; it lets them move the keychain head, mailbox readers and local
 * sealed state off it.
 */
export class DeviceSealedRootPayload {
  private static readonly SEPARATOR = '.';

  public static encode(roots: DeviceSealedRoots): string {
    return [roots.root, roots.previous]
      .filter((key): key is SymmetricKey => key !== undefined)
      .map((key) => encodeBase64Url(key.getBuffer()))
      .join(DeviceSealedRootPayload.SEPARATOR);
  }

  public static decode(payload: string): DeviceSealedRoots {
    const [root, previous, ...rest] = payload.split(
      DeviceSealedRootPayload.SEPARATOR,
    );

    if (root === undefined || rest.length > 0) {
      throw new Error('Invalid device sealed root payload.');
    }

    return {
      previous:
        previous === undefined
          ? undefined
          : SymmetricKey.fromBuffer(decodeBase64Url(previous)),
      root: SymmetricKey.fromBuffer(decodeBase64Url(root)),
    };
  }
}
