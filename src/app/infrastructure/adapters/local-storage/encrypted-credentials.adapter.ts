import { Injectable } from '@angular/core';
import { Credentials } from '@core/domain/models/credentials.model';
import { CredentialsPersistencePort } from '@core/domain/ports/credentials-persistence.port';

const DEVICE_KEY_ITEM = 'fp-device-key';
const CREDENTIALS_ITEM = 'fp-credentials';

interface EncryptedPayload {
  iv: string;
  data: string;
}

@Injectable()
export class EncryptedCredentialsAdapter implements CredentialsPersistencePort {

  async save(credentials: Credentials): Promise<void> {
    const key = await this.getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(
      JSON.stringify({ user: credentials.user, password: credentials.password, host: credentials.host }),
    );
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

    const payload: EncryptedPayload = {
      iv: this.toBase64(iv),
      data: this.toBase64(new Uint8Array(encrypted)),
    };
    localStorage.setItem(CREDENTIALS_ITEM, JSON.stringify(payload));
  }

  async load(): Promise<Credentials | null> {
    const raw = localStorage.getItem(CREDENTIALS_ITEM);
    if (!raw) return null;

    try {
      const { iv, data } = JSON.parse(raw) as EncryptedPayload;
      const key = await this.getOrCreateKey();
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: this.fromBase64(iv) },
        key,
        this.fromBase64(data),
      );
      const { user, password, host } = JSON.parse(new TextDecoder().decode(decrypted)) as {
        user: string;
        password: string;
        host: string;
      };
      return new Credentials(user, password, host);
    } catch {
      this.clearAll();
      return null;
    }
  }

  async delete(): Promise<void> {
    localStorage.removeItem(CREDENTIALS_ITEM);
  }

  private async getOrCreateKey(): Promise<CryptoKey> {
    const stored = localStorage.getItem(DEVICE_KEY_ITEM);
    if (stored) {
      return crypto.subtle.importKey(
        'raw',
        this.fromBase64(stored),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      );
    }

    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const exported = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(DEVICE_KEY_ITEM, this.toBase64(new Uint8Array(exported)));
    return key;
  }

  private toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...Array.from(bytes)));
  }

  private fromBase64(base64: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array(Array.from(atob(base64), (c) => c.charCodeAt(0)));
  }

  private clearAll(): void {
    localStorage.removeItem(CREDENTIALS_ITEM);
    localStorage.removeItem(DEVICE_KEY_ITEM);
  }
}
