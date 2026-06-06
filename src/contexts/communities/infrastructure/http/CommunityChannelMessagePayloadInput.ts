/* eslint-disable @typescript-eslint/no-use-before-define */

export type CommunityChannelMessagePayloadInput =
  | {
      encryptedPayload: string;
      plaintextPayload?: never;
    }
  | {
      encryptedPayload?: never;
      plaintextPayload: string;
    };
