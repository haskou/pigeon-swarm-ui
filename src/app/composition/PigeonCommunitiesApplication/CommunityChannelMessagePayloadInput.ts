export type CommunityChannelMessagePayloadInput =
  | {
      encryptedPayload: string;
      plaintextPayload?: never;
    }
  | {
      encryptedPayload?: never;
      plaintextPayload: string;
    };
