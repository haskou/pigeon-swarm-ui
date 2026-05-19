interface TypingIndicatorProps {
  getIdentityName: (identityId: string) => string;
  identityIds: string[];
}

export function TypingIndicator({
  getIdentityName,
  identityIds,
}: TypingIndicatorProps) {
  return (
    <div className="px-4 pb-2 text-xs font-black text-white/45 sm:px-6">
      {typingLabel(identityIds, getIdentityName)}
    </div>
  );
}

function typingLabel(
  identityIds: string[],
  getIdentityName: (identityId: string) => string,
): string {
  const [firstIdentityId, secondIdentityId] = identityIds;
  const firstName = firstIdentityId ? getIdentityName(firstIdentityId) : '';

  if (identityIds.length === 1) return `${firstName} is typing...`;

  if (identityIds.length === 2 && secondIdentityId) {
    return `${firstName} and ${getIdentityName(secondIdentityId)} are typing...`;
  }

  return `${firstName} and ${identityIds.length - 1} more are typing...`;
}
