export type DeviceAuthorizationCheckpointResource = {
  compromisedCredentials?: { compromisedSince: number; credential: string }[];
  epoch: string;
  identityId: string;
  revision: number;
};
