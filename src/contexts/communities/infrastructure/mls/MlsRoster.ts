import type { CommunityMlsRoster } from '../../domain/CommunityMlsRoster';

/** The signed community roster (not MLS): who holds leaves, who commits. */
export type MlsRoster = () => Promise<CommunityMlsRoster>;
