import type { CallMediaEncryptionWorkerScope } from './CallMediaEncryptionWorkerScope';

import { serveCallMediaEncryption } from './serveCallMediaEncryption';

serveCallMediaEncryption(self as unknown as CallMediaEncryptionWorkerScope);
