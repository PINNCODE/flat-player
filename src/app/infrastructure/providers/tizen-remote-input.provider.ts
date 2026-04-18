import { APP_INITIALIZER, Provider } from '@angular/core';
import { TizenRemoteInputService } from '@infrastructure/services/tizen-remote-input.service';

function initTizenRemoteInput(service: TizenRemoteInputService): () => void {
  return () => service.initialize();
}

function destroyTizenRemoteInput(service: TizenRemoteInputService): () => void {
  return () => service.destroy();
}

export const tizenRemoteInputProvider: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initTizenRemoteInput,
  deps: [TizenRemoteInputService],
  multi: true,
};
