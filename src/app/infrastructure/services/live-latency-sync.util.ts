/**
 * LiveLatencySyncUtil — "Punto Dulce Refinado"
 *
 * hls.js gestiona la aceleración base con maxLiveSyncPlaybackRate.
 * Este util añade una capa de control explícita para:
 *   - Soft catch-up forzado: cuando el buffer es saludable y la latencia es alta.
 *   - Freno de emergencia: cuando el buffer cae a niveles críticos.
 *   - Seek de resiliencia: para salir del estado congelado.
 *
 * Estrategias (evaluadas en orden):
 *  1. Stall detectado por timer            → resync
 *  2. Buffering activo o paused            → none (1.0x implícito)
 *  3. Latencia crítica (> 60s)             → seek a liveEdge − 15s
 *  4. Buffer < 15s  (freno de emergencia)   → brake → 1.0x
 *  5. Recuperación post-stall activa       → brake → 1.0x hasta buffer ≥ 30s
 *  6. Buffer > 30s && latencia > 45s         → catch-up → 1.05x (hasta lat < 35s)
 *  7. Default                              → none (hls.js gestiona con 1.05x)
 */

export interface LiveLatencySnapshot {
  readonly currentTime: number;
  readonly liveEdge: number;
  readonly liveSyncPosition: number | null;
  readonly bufferAhead: number;
  readonly paused: boolean;
  readonly buffering: boolean;
  readonly stalledRecovery: boolean;
  readonly nowMs: number;
}

export interface LiveLatencyDecision {
  /**
   * - 'none'     → hls.js gestiona la tasa (maxLiveSyncPlaybackRate activo).
   * - 'catch-up' → forzar 1.1x explícitamente (buffer sano, latencia alta).
   * - 'brake'    → forzar 1.0x (buffer crítico, anula hls.js).
   * - 'seek'     → salto de emergencia al live edge.
   * - 'resync'   → stream congelado, recargar manifesto.
   */
  readonly action: 'none' | 'catch-up' | 'brake' | 'seek' | 'resync';
  readonly targetTime: number | null;
}

export class LiveLatencySyncUtil {
  // ── Umbrales de buffer ────────────────────────────────────────────────────

  /**
   * Freno de emergencia: buffer por debajo → 1.0x inmediato.
   * Valor para segmentos de 10s con latencia de red de 200-300ms.
   */
  private static readonly EMERGENCY_BRAKE_BUFFER_SECONDS = 15;
  /** Buffer mínimo para activar el soft catch-up de 1.05x. */
  private static readonly CATCHUP_MIN_BUFFER_SECONDS = 30;

  /** Buffer mínimo para salir del modo de recuperación post-stall. */
  private static readonly STALL_RECOVERY_BUFFER_SECONDS = 30;

  // ── Umbrales de latencia ──────────────────────────────────────────────────

  /** Latencia mínima para iniciar el soft catch-up. */
  private static readonly CATCHUP_LATENCY_START_SECONDS = 45;

  /** Latencia objetivo al finalizar el catch-up. */
  private static readonly CATCHUP_LATENCY_STOP_SECONDS = 35;

  /** Seek de emergencia si hls.js no pudo sincronizar por sí solo. */
  private static readonly HARD_SEEK_LATENCY_SECONDS = 60;
  private static readonly HARD_SEEK_OFFSET_SECONDS = 15;

  // ── Tasa de reproducción del soft catch-up ────────────────────────────────
  /** Valor catch-up del util (complementa el maxLiveSyncPlaybackRate). */
  static readonly CATCHUP_RATE = 1.15;

  // ── Cooldowns ─────────────────────────────────────────────────────────────

  private static readonly RESYNC_COOLDOWN_MS = 20_000;
  private static readonly HARD_SEEK_COOLDOWN_MS = 30_000;
  private static readonly STALLED_CURRENT_TIME_DELTA = 0.1;
  private static readonly LIVE_EDGE_ADVANCE_DELTA = 0.5;

  // ── Estado interno ────────────────────────────────────────────────────────

  private lastCurrentTime = 0;
  private lastLiveEdge = 0;
  private lastResyncAt = 0;
  private lastHardSeekAt = 0;
  /** Hysteresis: true mientras el catch-up de 1.1x está activo. */
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
      return { action: 'resync', targetTime: null };
    }

    // ── 2. Reproducción pausada o buffering activo ────────────────────────
    if (snapshot.paused || snapshot.buffering) {
      this.isCatchingUp = false;
      return { action: 'none', targetTime: null };
    }

    // ── 3. Seek de emergencia: latencia crítica > 60s ─────────────────────
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
        targetTime: Math.max(0, snapshot.liveEdge - LiveLatencySyncUtil.HARD_SEEK_OFFSET_SECONDS),
      };
    }

    // ── 4. Freno de emergencia: buffer críticamente bajo ──────────────────
    if (snapshot.bufferAhead < LiveLatencySyncUtil.EMERGENCY_BRAKE_BUFFER_SECONDS) {
      this.isCatchingUp = false;
      return { action: 'brake', targetTime: null };
    }

    // ── 5. Recuperación post-stall ────────────────────────────────────────
    if (
      snapshot.stalledRecovery &&
      snapshot.bufferAhead < LiveLatencySyncUtil.STALL_RECOVERY_BUFFER_SECONDS
    ) {
      this.isCatchingUp = false;
      return { action: 'brake', targetTime: null };
    }

    // ── 6. Soft catch-up 1.05x con hysteresis ────────────────────────────
    //    Entrada:  buffer ≥ 30s  &&  latencia > 45s
    //    Salida:   latencia ≤ 35s  (o freno por buffer)
    if (!this.isCatchingUp) {
      if (
        snapshot.bufferAhead >= LiveLatencySyncUtil.CATCHUP_MIN_BUFFER_SECONDS &&
        latency > LiveLatencySyncUtil.CATCHUP_LATENCY_START_SECONDS
      ) {
        this.isCatchingUp = true;
      }
    } else {
      if (latency <= LiveLatencySyncUtil.CATCHUP_LATENCY_STOP_SECONDS) {
        this.isCatchingUp = false;
      }
    }

    if (this.isCatchingUp) {
      return { action: 'catch-up', targetTime: null };
    }

    // ── 7. Todo en orden → hls.js gestiona la aceleración ────────────────
    return { action: 'none', targetTime: null };
  }

  getBackBufferFlushEnd(currentTime: number): number {
    return Math.max(0, currentTime - LiveLatencySyncUtil.EMERGENCY_BRAKE_BUFFER_SECONDS * 2);
  }

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
