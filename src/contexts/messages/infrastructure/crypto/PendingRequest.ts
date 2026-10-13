import type { ProjectedMessage } from './ProjectedMessage';

export type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (projected: ProjectedMessage[]) => void;
};
