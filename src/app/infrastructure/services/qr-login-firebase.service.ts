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

    console.log('[Firebase] Initializing with config:', {
      authDomain: 'flat-iptv-player.firebaseapp.com',
      databaseURL: 'https://flat-iptv-player-default-rtdb.firebaseio.com',
      projectId: 'flat-iptv-player'
    });

    const firebaseConfig = {
      apiKey: "AIzaSyAL3_g2dVPMtt1kgy6jTcK-Ocvnd7Cwwco",
      authDomain: "flat-iptv-player.firebaseapp.com",
      databaseURL: "https://flat-iptv-player-default-rtdb.firebaseio.com",
      projectId: "flat-iptv-player",
      storageBucket: "flat-iptv-player.firebasestorage.app",
      messagingSenderId: "801131571482",
      appId: "1:801131571482:web:906095db98553d08b024a3",
      measurementId: "G-XBRHSLW8JY"
    };

    try {
      this.app = initializeApp(firebaseConfig);
      this.db = getDatabase(this.app);
      console.log('[Firebase] Initialized successfully');
    } catch (error) {
      console.error('[Firebase] Initialization failed:', error);
    }
  }

  async createSession(): Promise<string> {
    this.initialize();
    if (!this.db) {
      console.error('[Firebase] createSession: DB not initialized');
      throw new Error('Firebase not initialized');
    }

    const sessionId = this.generateSessionId();
    console.log('[Firebase] Creating session:', sessionId);

    const sessionRef = ref(this.db, `sessions/${sessionId}`);

    const sessionData = {
      createdAt: serverTimestamp(),
      expiresAt: Date.now() + this.SESSION_EXPIRY_MS,
      status: 'waiting',
      credentials: null,
    };

    try {
      await set(sessionRef, sessionData);
      console.log('[Firebase] Session created:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('[Firebase] createSession failed:', error);
      throw error;
    }
  }

  listenForCredentials(sessionId: string, callback: (credentials: Credentials) => void): void {
    console.log('[Firebase] listenForCredentials: Starting listener for session:', sessionId);

    this.initialize();
    if (!this.db) {
      console.error('[Firebase] listenForCredentials: DB not initialized');
      throw new Error('Firebase not initialized');
    }

    this.cleanup();

    const sessionRef = ref(this.db, `sessions/${sessionId}`);
    console.log('[Firebase] Listening at path:', `sessions/${sessionId}`);

    this.currentUnsubscribe = () => {
      console.log('[Firebase] Unsubscribing from session:', sessionId);
      off(sessionRef);
    };

    onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      console.log('[Firebase] onValue triggered. Data:', JSON.stringify(data));

      if (!data) {
        console.log('[Firebase] No data in snapshot');
        return;
      }

      if (data.status === 'filled' && data.credentials) {
        console.log('[Firebase] Credentials received!:', {
          host: data.credentials.host,
          user: data.credentials.user,
          password: '***'
        });

        const credentials: Credentials = {
          host: data.credentials.host || data.credentials.server_url || '',
          user: data.credentials.user || data.credentials.username || '',
          password: data.credentials.password || '',
        };

        callback(credentials);
        this.cleanupSession(sessionId);
        return;
      }

      if (data.status === 'expired' || (data.expiresAt && Date.now() > data.expiresAt)) {
        console.log('[Firebase] Session expired');
        this.cleanupSession(sessionId);
        return;
      }

      if (data.status === 'waiting') {
        console.log('[Firebase] Session waiting for credentials...');
      }
    }, (error) => {
      console.error('[Firebase] onValue error:', error);
    });
  }

  async markSessionExpired(sessionId: string): Promise<void> {
    console.log('[Firebase] markSessionExpired:', sessionId);
    if (!this.db) return;

    try {
      const sessionRef = ref(this.db, `sessions/${sessionId}`);
      await update(sessionRef, { status: 'expired' });
      console.log('[Firebase] Session marked as expired:', sessionId);
    } catch (error) {
      console.error('[Firebase] markSessionExpired failed:', error);
    }
  }

  listenForExpiration(sessionId: string, callback: () => void): void {
    console.log('[Firebase] listenForExpiration: Starting listener for session:', sessionId);

    this.initialize();
    if (!this.db) {
      console.error('[Firebase] listenForExpiration: DB not initialized');
      return;
    }

    const sessionRef = ref(this.db, `sessions/${sessionId}`);

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const isExpired = data.status === 'expired' || (data.expiresAt && Date.now() > data.expiresAt);
      if (isExpired) {
        console.log('[Firebase] Session expired detected via listener');
        callback();
        off(sessionRef);
      }
    }, (error) => {
      console.error('[Firebase] onValue error:', error);
    });

    this.currentUnsubscribe = unsubscribe;
  }

  async sendCredentials(sessionId: string, credentials: Credentials): Promise<void> {
    console.log('[Firebase] sendCredentials: Sending to session:', sessionId);
    console.log('[Firebase] Credentials:', {
      host: credentials.host,
      user: credentials.user,
      password: '***'
    });

    this.initialize();
    if (!this.db) {
      console.error('[Firebase] sendCredentials: DB not initialized');
      throw new Error('Firebase not initialized');
    }

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

    try {
      await update(sessionRef, updateData);
      console.log('[Firebase] Credentials sent successfully to session:', sessionId);
    } catch (error) {
      console.error('[Firebase] sendCredentials failed:', error);
      throw error;
    }
  }

  async cleanupSession(sessionId: string): Promise<void> {
    console.log('[Firebase] cleanupSession:', sessionId);
    if (!this.db) return;

    try {
      const sessionRef = ref(this.db, `sessions/${sessionId}`);
      await remove(sessionRef);
      console.log('[Firebase] Session removed:', sessionId);
    } catch (error) {
      console.error('[Firebase] cleanupSession failed:', error);
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
