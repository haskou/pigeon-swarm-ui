import type { CommunityOperationContent } from './CommunityOperationContent';

/** A community operation as the nodes store and serve it. */
export interface CommunityOperationDocument extends CommunityOperationContent {
  id: string;
  identitySignature: string;
}
