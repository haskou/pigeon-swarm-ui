import type { CreatePollRequest } from './CreatePollRequest';

/** Poll creation as the user states it; ids and timestamps are assigned. */
export type CreatePollInput = CreatePollRequest extends infer Request
  ? Request extends CreatePollRequest
    ? Omit<Request, 'createdAt' | 'pollId'>
    : never
  : never;
