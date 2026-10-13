/** Public enrollment data: the credential to ask and its PRF salt. */
export type DevicePasskeyCredential = {
  credentialId: string;
  salt: string;
};
