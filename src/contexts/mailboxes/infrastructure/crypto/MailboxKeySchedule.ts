import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { Buffer } from 'buffer';

export type MailboxKeys = {
  envelopeKey: Uint8Array;
  mailboxId: string;
  postToken: string;
};

/**
 * Per-epoch mailbox material for the inbox of one identity in a 1:1
 * conversation, derived from the shared conversation secret S. The node never
 * derives anything: it sees `mailboxId`, the hash of `postToken` and the
 * hash of the read token. Sender and recipient must agree on this schedule
 * byte for byte.
 *
 * Direction is the recipient identity, so each side has its own inbox. The
 * epoch gives fresh identifiers per rotation.
 */
export class MailboxKeySchedule {
  public static readonly SECRET_BYTES = 32;
  private static readonly ENVELOPE_LABEL = 'pigeon/mailbox/envelope/v1';
  private static readonly ID_LABEL = 'pigeon/mailbox/id/v1';
  private static readonly MAX_EPOCH = 0xffff_ffff;
  private static readonly POST_LABEL = 'pigeon/mailbox/post/v1';

  /**
   * Context is `label ‖ recipientIdentityId ‖ u32be(epoch)`. The label is fixed
   * per purpose, so the encoding is unambiguous.
   */
  private static info(
    label: string,
    recipientIdentityId: string,
    epoch: number,
  ): Uint8Array {
    const epochBytes = new Uint8Array(4);

    new DataView(epochBytes.buffer).setUint32(0, epoch);

    return concatBytes(
      new TextEncoder().encode(label),
      new TextEncoder().encode(recipientIdentityId),
      epochBytes,
    );
  }

  private static expand(
    sharedSecret: Uint8Array,
    label: string,
    recipientIdentityId: string,
    epoch: number,
  ): Uint8Array {
    return hkdf(
      sha256,
      sharedSecret,
      undefined,
      MailboxKeySchedule.info(label, recipientIdentityId, epoch),
      32,
    );
  }

  public static derive(
    sharedSecret: Uint8Array,
    recipientIdentityId: string,
    epoch: number,
  ): MailboxKeys {
    if (sharedSecret.length !== MailboxKeySchedule.SECRET_BYTES) {
      throw new RangeError('Mailbox shared secret must be 32 bytes');
    }

    if (recipientIdentityId.length === 0) {
      throw new RangeError('Mailbox recipient identity is required');
    }

    if (
      !Number.isSafeInteger(epoch) ||
      epoch < 0 ||
      epoch > MailboxKeySchedule.MAX_EPOCH
    ) {
      throw new RangeError('Mailbox epoch must be a uint32');
    }

    return {
      envelopeKey: MailboxKeySchedule.expand(
        sharedSecret,
        MailboxKeySchedule.ENVELOPE_LABEL,
        recipientIdentityId,
        epoch,
      ),
      mailboxId: Buffer.from(
        MailboxKeySchedule.expand(
          sharedSecret,
          MailboxKeySchedule.ID_LABEL,
          recipientIdentityId,
          epoch,
        ),
      ).toString('base64url'),
      postToken: Buffer.from(
        MailboxKeySchedule.expand(
          sharedSecret,
          MailboxKeySchedule.POST_LABEL,
          recipientIdentityId,
          epoch,
        ),
      ).toString('base64url'),
    };
  }
}
