export class ConversationDraftCollection {
  public static mergeMissing(
    localDrafts: Record<string, string>,
    remoteDrafts: Array<{ content: string; conversationId: string }>,
  ): Record<string, string> {
    const merged = { ...localDrafts };

    for (const draft of remoteDrafts) {
      if (merged[draft.conversationId] === undefined) {
        merged[draft.conversationId] = draft.content;
      }
    }

    return merged;
  }
}
