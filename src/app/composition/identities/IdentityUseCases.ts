import type { IdentityPresenceFinder } from '../../../contexts/identities/application/find-identity-presence/IdentityPresenceFinder';
import type { IdentityFinder } from '../../../contexts/identities/application/find-identity/IdentityFinder';
import type { LoginIdentity } from '../../../contexts/identities/application/login-identity/LoginIdentity';
import type { IdentityRefresher } from '../../../contexts/identities/application/refresh-identity/IdentityRefresher';
import type { RegisterIdentity } from '../../../contexts/identities/application/register-identity/RegisterIdentity';
import type { RememberedIdentityRestorer } from '../../../contexts/identities/application/restore-remembered-identity/RememberedIdentityRestorer';
import type { IdentityPresencesSearcher } from '../../../contexts/identities/application/search-identity-presences/IdentityPresencesSearcher';
import type { IdentityPresenceUpdater } from '../../../contexts/identities/application/update-identity-presence/IdentityPresenceUpdater';
import type { IdentityProfileUpdater } from '../../../contexts/identities/application/update-identity-profile/IdentityProfileUpdater';

export type IdentityUseCases = {
  finder: IdentityFinder;
  login: LoginIdentity;
  presenceFinder: IdentityPresenceFinder;
  presenceSearcher: IdentityPresencesSearcher;
  presenceUpdater: IdentityPresenceUpdater;
  profileUpdater: IdentityProfileUpdater;
  refresher: IdentityRefresher;
  register: RegisterIdentity;
  rememberedIdentityRestorer: RememberedIdentityRestorer;
};
