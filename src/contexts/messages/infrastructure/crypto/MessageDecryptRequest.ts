/* eslint-disable @typescript-eslint/no-use-before-define */

import type { MessageResource } from '../../../../shared/domain/pigeonResources.types';

export type MessageDecryptRequest = {
  conversationId: string;
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  requestId: number;
  symmetricKey?: string;
};
