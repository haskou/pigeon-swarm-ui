/**
 * A key package request to another device of this identity, waiting for
 * its answer; `deviceCredential` names the device asked.
 */
export type PendingGroupMailboxKeyPackage = {
  readonly conversationId: string;
  readonly deviceCredential: string;
  readonly reject: (error: Error) => void;
  readonly resolve: (keyPackage: Uint8Array) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};
