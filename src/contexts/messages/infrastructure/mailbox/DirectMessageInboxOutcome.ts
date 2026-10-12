/**
 * How an open of one recipient inbox ended. 'rate-limited' is the node's
 * creation cap: the pass that hits it stops, and the next pass resumes.
 */
export type DirectMessageInboxOutcome = 'failed' | 'open' | 'rate-limited';
