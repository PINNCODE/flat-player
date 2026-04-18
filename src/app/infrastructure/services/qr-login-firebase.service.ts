import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { Database, getDatabase, set, update, ref, onValue, off, serverTimestamp, remove } from 'firebase/database';
import { Credentials } from '@core/domain/models/credentials.model';

@Injectable({ providedIn: 'root' })
export class QrLoginFirebaseService {
  private app: FirebaseApp | null = null;
  private db: Database | null = null;
  private currentUnsubscribe: (() => void) | null = null;

  private readonly SESSION_EXPIRY_MS = 5 * 60 * 1000;

  private initialize(): void {
    if (this.app) return;

    const firebaseConfig = {
      apiKey: "AIzaSyAL3_g2dVPMtt1kgy6jTcK-Ocvnd7Cwwco",
      authDomain: "flat-iptv-player.firebaseapp.com",
      projectId: "flat-iptv-player",
      storageBucket: "flat-iptv-player.firebasestorage.app",
      messagingSenderId: "801131571482",
      appId: "1:801131571482:web:906095db98553d08b024a3",
      measurementId: "G-XBRHSLW8JY"
    };

    this.app = initializeApp(firebaseConfig);
    this.db = getDatabase(this.app);
  }

  async createSession(): Promise<string> {
    this.initialize();
    if (!this.db) throw new Error('Firebase not initialized');

    const sessionId = this.generateSessionId();
    const sessionRef = ref(this.db, `sessions/${sessionId}`);

    const sessionData = {
      createdAt: serverTimestamp(),
      expiresAt: Date.now() + this.SESSION_EXPIRY_MS,
      status: 'waiting',
      credentials: null,
    };

    await set(sessionRef, sessionData);
    return sessionId;
  }

  listenForCredentials(sessionId: string, callback: (credentials: Credentials) => void): void {
    this.initialize();
    if (!this.db) throw new Error('Firebase not initialized');

    this.cleanup();

    const sessionRef = ref(this.db, `sessions/${sessionId}`);

    this.currentUnsubscribe = () => {
      off(sessionRef);
    };

    onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) return;

      if (data.status === 'filled' && data.credentials) {
        const credentials: Credentials = {
          host: data.credentials.host || data.credentials.server_url || '',
          user: data.credentials.user || data.credentials.username || '',
          password: data.credentials.password || '',
        };

        callback(credentials);
        this.cleanupSession(sessionId);
      }

      if (data.status === 'expired' || (data.expiresAt && Date.now() > data.expiresAt)) {
        this.cleanupSession(sessionId);
      }
    });
  }

  async sendCredentials(sessionId: string, credentials: Credentials): Promise<void> {
    this.initialize();
    if (!this.db) throw new Error('Firebase not initialized');

    const sessionRef = ref(this.db, `sessions/${sessionId}`);

    const updateData = {
      status: 'filled',
      credentials: {
        host: credentials.host,
        user: credentials.user,
        password: credentials.password,
      },
      filledAt: serverTimestamp(),
    };

    await update(sessionRef, updateData);
  }

  async cleanupSession(sessionId: string): Promise<void> {
    if (!this.db) return;

    try {
      const sessionRef = ref(this.db, `sessions/${sessionId}`);
      await remove(sessionRef);
    } catch {
      // Ignore cleanup errors
    }

    this.cleanup();
  }

  cleanup(): void {
    if (this.currentUnsubscribe) {
      this.currentUnsubscribe();
      this.currentUnsubscribe = null;
    }
  }

  private generateSessionId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
