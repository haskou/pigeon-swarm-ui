/* eslint-disable @typescript-eslint/no-use-before-define */

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

export type MessageDecryptResponse =
  | {
      messages: ChatMessage[];
      requestId: number;
      type: 'success';
    }
  | {
      message: string;
      requestId: number;
      type: 'error';
    };
