export type MarkdownMentionMatcher = {
  identityIds: Map<string, string | undefined>;
  pattern: RegExp;
};
