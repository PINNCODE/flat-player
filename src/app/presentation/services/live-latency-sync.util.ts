/**
 * LiveLatencySyncUtil — "El Punto Dulce"
 *
 * Prioridad: Estabilidad primero, acercamiento gradual al vivo.
 * Objetivo de latencia: ~22s con fragmentos largos en Tizen Smart TV.
 *
 * Estrategias (evaluadas en orden):
 *  1. Stall detectado por timer       → resync + 1.0x.
 *  2. Buffering activo o paused       → none + 1.0x.
 *  3. Latencia crítica (> 60s)        → seek único a liveEdge - 20s.
 *  4. Buffer < 10s (freno seguridad)  → none + 1.0x, cancelar catch-up activo.
 *  5. Recuperación post-stall activa  → none + 1.0x hasta buffer ≥ 8s.
 *  6. Buffer > 20s && latencia > 22s  → catch-up 1.1x.
 *  7. Default                         → none + 1.0x.
 */

export interface LiveLatencySnapshot {
  readonly currentTime: number;
  readonly liveEdge: number;
  readonly liveSyncPosition: number | null;
  readonly bufferAhead: number;
  readonly paused: boolean;
  /** true mientras el evento 'waiting' esté activo o se haya recibido bufferStalledError */
  readonly buffering: boolean;
  /** true si hemos recibido un bufferStalledError reciente que aún no se ha recuperado */
  readonly stalledRecovery: boolean;
  readonly nowMs: number;
}

export interface LiveLatencyDecision {
  readonly action: 'none' | 'catch-up' | 'seek' | 'resync';
  readonly playbackRate: number;
  readonly targetTime: number | null;
}

export class LiveLatencySyncUtil {
  // ── Umbrales de buffer ────────────────────────────────────────────────────

  /**
   * Freno de seguridad: si el buffer cae por debajo de este valor durante
   * una aceleración, se frena a 1.0x de inmediato y se cancela el catch-up.
   */
  private static readonly SAFETY_BRAKE_BUFFER_SECONDS = 10;

  /**
   * Buffer mínimo para activar el catch-up de 1.1x.
   * Con >20s garantizamos al menos 2 fragmentos completos de margen.
   */
  private static readonly CATCHUP_MIN_BUFFER_SECONDS = 20;

  /**
   * Tras un stall, se exige este buffer antes de reanudar cualquier aceleración.
   */
  private static readonly STALL_RECOVERY_BUFFER_SECONDS = 8;

  // ── Umbrales de latencia ──────────────────────────────────────────────────

  /**
   * Latencia objetivo: el catch-up se mantiene activo hasta alcanzar este valor.
   * La hysteresis evita el efecto on/off: se activa >22s se desactiva ≤22s.
   */
  private static readonly CATCHUP_LATENCY_STOP_SECONDS = 22;

  /**
   * Seek de emergencia: si la latencia supera este valor se ejecuta
   * un seek único hacia liveEdge - HARD_SEEK_OFFSET_SECONDS.
   */
  private static readonly HARD_SEEK_LATENCY_SECONDS = 60;

  /** Margen que se deja al live edge en el seek de emergencia. */
  private static readonly HARD_SEEK_OFFSET_SECONDS = 20;

  // ── Tasas de reproducción ─────────────────────────────────────────────────

  /** Aceleración perceptible pero estable; ~6s ganados por cada minuto. */
  private static readonly CATCHUP_PLAYBACK_RATE = 1.1;
  private static readonly NORMAL_PLAYBACK_RATE = 1;

  // ── Detección de stall por timer ──────────────────────────────────────────

  private static readonly RESYNC_COOLDOWN_MS = 20_000;
  private static readonly STALLED_CURRENT_TIME_DELTA = 0.1;
  private static readonly LIVE_EDGE_ADVANCE_DELTA = 0.5;

  /** Cooldown entre seeks de emergencia para evitar bucles. */
  private static readonly HARD_SEEK_COOLDOWN_MS = 30_000;

  // ── Estado interno ────────────────────────────────────────────────────────

  private lastCurrentTime = 0;
  private lastLiveEdge = 0;
  private lastResyncAt = 0;
  private lastHardSeekAt = 0;
  /** true mientras el catch-up de 1.1x está activo (hysteresis aplicada). */
  private isCatchingUp = false;

  // ─────────────────────────────────────────────────────────────────────────

  evaluate(snapshot: LiveLatencySnapshot): LiveLatencyDecision {
    const latency = Math.max(0, snapshot.liveEdge - snapshot.currentTime);
    const isStalled = this.isPlaybackStalled(snapshot);

    this.lastCurrentTime = snapshot.currentTime;
    this.lastLiveEdge = snapshot.liveEdge;

    // ── 1. Stall detectado por delta de currentTime ───────────────────────
    if (isStalled) {
      this.lastResyncAt = snapshot.nowMs;
      this.isCatchingUp = false;
      return {
        action: 'resync',
        playbackRate: LiveLatencySyncUtil.NORMAL_PLAYBACK_RATE,
        targetTime: null,
      };
    }

    // ── 2. Reproducción pausada o buffering activo ────────────────────────
    if (snapshot.paused || snapshot.buffering) {
      this.isCatchingUp = false;
      return {
        action: 'none',
        playbackRate: LiveLatencySyncUtil.NORMAL_PLAYBACK_RATE,
        targetTime: null,
      };
    }

    // ── 3. Seek de emergencia: latencia crítica > 60s ─────────────────────
    //    Se ejecuta una sola vez cada HARD_SEEK_COOLDOWN_MS para evitar bucles.
    const seekCooldownExpired =
      snapshot.nowMs - this.lastHardSeekAt >= LiveLatencySyncUtil.HARD_SEEK_COOLDOWN_MS;

    if (
      latency > LiveLatencySyncUtil.HARD_SEEK_LATENCY_SECONDS &&
      seekCooldownExpired &&
      Number.isFinite(snapshot.liveEdge)
    ) {
      this.lastHardSeekAt = snapshot.nowMs;
      this.isCatchingUp = false;
      return {
        action: 'seek',
        playbackRate: LiveLatencySyncUtil.NORMAL_PLAYBACK_RATE,
        targetTime: Math.max(0, snapshot.liveEdge - LiveLatencySyncUtil.HARD_SEEK_OFFSET_SECONDS),
      };
    }

    // ── 4. Freno de seguridad: buffer bajo ───────────────────────────────
    if (snapshot.bufferAhead < LiveLatencySyncUtil.SAFETY_BRAKE_BUFFER_SECONDS) {
      this.isCatchingUp = false;
      return {
        action: 'none',
        playbackRate: LiveLatencySyncUtil.NORMAL_PLAYBACK_RATE,
        targetTime: null,
      };
    }

    // ── 5. Recuperación post-stall ────────────────────────────────────────
    if (
      snapshot.stalledRecovery &&
      snapshot.bufferAhead < LiveLatencySyncUtil.STALL_RECOVERY_BUFFER_SECONDS
    ) {
      this.isCatchingUp = false;
      return {
        action: 'none',
        playbackRate: LiveLatencySyncUtil.NORMAL_PLAYBACK_RATE,
        targetTime: null,
      };
    }

    // ── 6. Catch-up 1.1x con hysteresis ──────────────────────────────────
    //    Condición de entrada:  buffer > 20s && latencia > 22s
    //    Condición de salida:   latencia ≤ 22s  (o buffer cae bajo el freno)
    if (!this.isCatchingUp) {
      const bufferSufficient =
        snapshot.bufferAhead >= LiveLatencySyncUtil.CATCHUP_MIN_BUFFER_SECONDS;
      const latencyAboveTarget =
        latency > LiveLatencySyncUtil.CATCHUP_LATENCY_STOP_SECONDS;

      if (bufferSufficient && latencyAboveTarget) {
        this.isCatchingUp = true;
      }
    } else {
      // Desactivar por latencia ya alcanzada
      if (latency <= LiveLatencySyncUtil.CATCHUP_LATENCY_STOP_SECONDS) {
        this.isCatchingUp = false;
      }
    }

    if (this.isCatchingUp) {
      return {
        action: 'catch-up',
        playbackRate: LiveLatencySyncUtil.CATCHUP_PLAYBACK_RATE,
        targetTime: null,
      };
    }

    // ── 7. Velocidad normal ───────────────────────────────────────────────
    return {
      action: 'none',
      playbackRate: LiveLatencySyncUtil.NORMAL_PLAYBACK_RATE,
      targetTime: null,
    };
  }

  /** Punto hasta donde se puede vaciar el back-buffer de forma segura. */
  getBackBufferFlushEnd(currentTime: number): number {
    return Math.max(0, currentTime - LiveLatencySyncUtil.CATCHUP_MIN_BUFFER_SECONDS * 2);
  }

  /**
   * Detecta si el playback está congelado comparando el avance de currentTime
   * con el avance real del live edge entre dos muestras consecutivas del timer.
   */
  private isPlaybackStalled(snapshot: LiveLatencySnapshot): boolean {
    if (snapshot.paused || snapshot.buffering) {
      return false;
    }

    const currentDelta = Math.abs(snapshot.currentTime - this.lastCurrentTime);
    const liveEdgeAdvance = snapshot.liveEdge - this.lastLiveEdge;
    const cooldownActive =
      snapshot.nowMs - this.lastResyncAt < LiveLatencySyncUtil.RESYNC_COOLDOWN_MS;

    return (
      !cooldownActive &&
      currentDelta < LiveLatencySyncUtil.STALLED_CURRENT_TIME_DELTA &&
      liveEdgeAdvance > LiveLatencySyncUtil.LIVE_EDGE_ADVANCE_DELTA
    );
  }
}
