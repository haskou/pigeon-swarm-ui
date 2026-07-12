/* eslint-disable @typescript-eslint/no-use-before-define */

import type { MessageResource } from '../../../../shared/domain/pigeonResources.types';

export type MessageListEnvelope = {
  cursor?: string | null;
  data?: MessageResource[];
  items?: MessageResource[];
  messages?: MessageResource[];
  nextBeforeMessageId?: string | null;
  nextCursor?: string | null;
};
