import type { PollSnapshot } from '../../../domain/PollSnapshot';
import type { PollScopeResource } from './PollScopeResource';

/** A node-backed poll: what it shows plus the scope it lives in. */
export type PollResource = PollSnapshot & {
  scope: PollScopeResource;
};
