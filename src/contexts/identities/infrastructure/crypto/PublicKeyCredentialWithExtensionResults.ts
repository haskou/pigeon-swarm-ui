import type { PrfExtensionResults } from './PrfExtensionResults';

export type PublicKeyCredentialWithExtensionResults = PublicKeyCredential & {
  getClientExtensionResults(): {
    prf?: PrfExtensionResults;
  };
};
