declare const PIGEON_INDEPENDENT_CLIENT: boolean;

export function isIndependentClient(): boolean {
  return (
    typeof PIGEON_INDEPENDENT_CLIENT !== 'undefined' &&
    PIGEON_INDEPENDENT_CLIENT
  );
}
