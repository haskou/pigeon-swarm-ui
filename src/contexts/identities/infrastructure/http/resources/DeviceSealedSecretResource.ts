export type DeviceSealedSecretEntryResource = {
  recipientCredential: string;
  sealedSecret: string;
  signature: string;
};

export type DeviceSealedSecretPublicationResource = {
  authorizationRevision: number;
  entries: DeviceSealedSecretEntryResource[];
  generation: number;
};

export type DeviceSealedSecretPublishedResource = {
  authorizationRevision: number;
  generation: number;
  identityId: string;
};

export type DeviceSealedSecretResource = DeviceSealedSecretEntryResource & {
  authorizationRevision: number;
  generation: number;
  identityId: string;
  publisherCredential: string;
};

/**
 * A generation handed to the remaining devices inside a device's own
 * retirement transition. The node takes its authorization revision from the
 * transition and its publisher from the retiring device.
 */
export type DeviceSealedSecretHandOverResource = {
  entries: DeviceSealedSecretEntryResource[];
  generation: number;
};

/** The node's confirmation that it stored a hand-over generation. */
export type DeviceSealedSecretHandedOverResource = {
  authorizationRevision: number;
  generation: number;
};
