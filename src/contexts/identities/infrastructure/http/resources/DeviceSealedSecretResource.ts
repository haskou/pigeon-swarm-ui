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
