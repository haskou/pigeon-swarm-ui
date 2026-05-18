import {
  identityDisplayName,
  type IdentityNames,
} from '../../utils/identityDisplay';

interface ChatTypingIndicatorProps {
  identityIds: string[];
  identityNames: IdentityNames;
}

export function ChatTypingIndicator({
  identityIds,
  identityNames,
}: ChatTypingIndicatorProps) {
  return (
    <div className="px-4 pb-2 text-xs font-black text-white/45 sm:px-6">
      {typingLabel(identityIds, identityNames)}
    </div>
  );
}

function typingLabel(
  identityIds: string[],
  identityNames: IdentityNames,
): string {
  const [firstIdentityId, secondIdentityId] = identityIds;
  const firstName = firstIdentityId
    ? identityDisplayName(firstIdentityId, identityNames)
    : '';

  if (identityIds.length === 1) return `${firstName} is typing...`;

  if (identityIds.length === 2 && secondIdentityId) {
    return `${firstName} and ${identityDisplayName(
      secondIdentityId,
      identityNames,
    )} are typing...`;
  }

  return `${firstName} and ${identityIds.length - 1} more are typing...`;
}
