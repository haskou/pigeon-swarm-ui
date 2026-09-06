import { clientNodeForDocument } from '../shared/infrastructure/client/clientNodeForDocument';
import { isIndependentClient } from '../shared/infrastructure/client/isIndependentClient';

declare const __PIGEON_API_SERVER_URL__: string;

export const API_SERVER_URL = isIndependentClient()
  ? clientNodeForDocument()!.url
  : typeof __PIGEON_API_SERVER_URL__ === 'string'
    ? __PIGEON_API_SERVER_URL__
    : 'http://localhost:8080/';
