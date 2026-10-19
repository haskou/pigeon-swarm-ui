import { en } from '../../../../shared/presentation/i18n/en';
import { es } from '../../../../shared/presentation/i18n/es';

describe('networksLoadFailed copy', () => {
  it('defines a dedicated English message that is not the node settings message', () => {
    expect(en.dialog.networksLoadFailed).toBe(
      'Networks could not be loaded from this node. Try again.',
    );
    expect(en.dialog.networksLoadFailed).not.toBe(en.nodeSettings.error);
  });

  it('defines a dedicated Spanish message', () => {
    expect(es.dialog.networksLoadFailed).toBe(
      'No se pudieron cargar las redes de este nodo. Inténtalo de nuevo.',
    );
  });
});
