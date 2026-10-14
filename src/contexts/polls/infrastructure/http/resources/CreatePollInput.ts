import type { CreatePollRequest } from './CreatePollRequest';

/** Poll creation as the user states it; ids and timestamps are assigned. */
export type CreatePollInput = Omit<CreatePollRequest, 'createdAt' | 'pollId'>;
