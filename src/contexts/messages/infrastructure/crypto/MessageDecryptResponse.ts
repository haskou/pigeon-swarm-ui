/* eslint-disable @typescript-eslint/no-use-before-define */

import type { ProjectedMessage } from './ProjectedMessage';

export type MessageDecryptResponse =
  | {
      projected: ProjectedMessage[];
      requestId: number;
      type: 'success';
    }
  | {
      message: string;
      requestId: number;
      type: 'error';
    };
