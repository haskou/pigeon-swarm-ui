const domain = 'pigeon-swarm:safety-number:v1';
const groupCount = 12;
const bytesPerGroup = 5;

/**
 * Safety number both members of a direct conversation can compare out of band.
 * It is derived from the two identity ids, which are the keys conversation keys
 * are wrapped to, so a matching number proves both sides see the same keys.
 * The order of the ids does not matter. Each group is five decimal digits.
 */
export class SafetyNumber {
  public static async between(
    firstIdentityId: string,
    secondIdentityId: string,
  ): Promise<string[]> {
    const ordered =
      firstIdentityId <= secondIdentityId
        ? `${firstIdentityId}\n${secondIdentityId}`
        : `${secondIdentityId}\n${firstIdentityId}`;
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-512',
        new TextEncoder().encode(`${domain}\n${ordered}`),
      ),
    );

    return Array.from({ length: groupCount }, (_, group) => {
      let value = 0;

      for (let index = 0; index < bytesPerGroup; index += 1) {
        value = value * 256 + digest[group * bytesPerGroup + index];
      }

      return String(value % 100_000).padStart(5, '0');
    });
  }
}
