import type { NetworkAttachmentStatusValue } from './value-objects/NetworkAttachmentStatusValue';

export type NetworkPrimitives = {
  id: string;
  key: string | undefined;
  name: string;
  privateNetwork?: boolean;
  status: NetworkAttachmentStatusValue;
};
