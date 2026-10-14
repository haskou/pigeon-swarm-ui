import type { CommunityRosterHistory } from '../../domain/CommunityRosterHistory';

/** The community's signed roster history, as it stands now. */
export type MlsRoster = () => Promise<CommunityRosterHistory>;
