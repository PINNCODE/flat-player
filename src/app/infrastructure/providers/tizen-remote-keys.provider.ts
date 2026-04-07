import { APP_INITIALIZER, Provider } from '@angular/core';
import { TizenRemoteKeysAdapter } from '@infrastructure/adapters/tizen/tizen-remote-keys.adapter';

function initTizenRemoteKeys(adapter: TizenRemoteKeysAdapter): () => void {
  return () => adapter.registerKeys();
}

export const tizenRemoteKeysProvider: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initTizenRemoteKeys,
  deps: [TizenRemoteKeysAdapter],
  multi: true,
};
