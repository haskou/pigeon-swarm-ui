import type { GroupMailboxGenesis } from '../../domain/GroupMailboxGenesis';

/**
 * A control record of a group conversation. Key-package requests and
 * responses and welcomes travel to one peer in a letter its sender signs
 * (the library `GroupMailboxControlLetter`), so the signature authenticates
 * their author.
 * Commits travel in the group inboxes `I(Y,k)`, and MLS authenticates them.
 * Application messages travel there too, as one MLS ciphertext whose sender
 * MLS authenticates. `gen_k` is never part of a record: a welcome carries
 * only the public index `k`. A key-package request a device sends its own
 * identity names the one other device it asks (`deviceCredential`); a
 * welcome names the one device whose key package it opens. A key-package
 * request carries the group's genesis when its sender knows it, so the joiner
 * learns the creator; only its derivation of the conversation id vouches for
 * it.
 */
export type GroupMailboxControlFields =
  | {
      readonly conversationId: string;
      readonly deviceCredential?: string;
      readonly genesis?: GroupMailboxGenesis;
      readonly requestId: string;
      readonly type: 'key-package-request';
    }
  | {
      readonly conversationId: string;
      readonly keyPackage: Uint8Array;
      readonly requestId: string;
      readonly type: 'key-package-response';
    }
  | {
      readonly conversationId: string;
      readonly deviceCredential: string;
      readonly index: number;
      readonly type: 'welcome';
      readonly welcome: Uint8Array;
    }
  | {
      readonly commit: Uint8Array;
      readonly conversationId: string;
      readonly type: 'commit';
    }
  | {
      readonly ciphertext: Uint8Array;
      readonly conversationId: string;
      readonly type: 'message';
    };
