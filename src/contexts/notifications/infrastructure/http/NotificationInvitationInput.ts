/**
 * What an invitation names. A group control letter names no subject: its
 * conversation travels only inside the sealed key.
 */
export type NotificationInvitationInput =
  | {
      encryptedKey: string;
      recipientIdentityId: string;
      type: 'group_conversation_invitation';
    }
  | {
      encryptedKey?: string;
      recipientIdentityId: string;
      subjectId: string;
      type: 'community_invitation' | 'conversation_invitation';
    };
