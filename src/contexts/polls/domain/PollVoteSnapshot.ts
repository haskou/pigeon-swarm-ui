/** One voter's current choice on a poll. */
export type PollVoteSnapshot = {
  createdAt: number;
  optionIds: string[];
  voterIdentityId: string;
};
