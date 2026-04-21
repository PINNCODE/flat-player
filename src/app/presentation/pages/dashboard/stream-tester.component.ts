import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import Hls from 'hls.js';
import { TvCatalogHttpAdapter } from '@infrastructure/adapters/http/tv-catalog-http.adapter';
import { VideoPlaybackFacade } from '@infrastructure/services/video-playback.facade';
import { AUTH_SESSION_PORT } from '@core/domain/ports/auth-session.port';
import { TvChannel } from '@core/domain/models/tv-catalog.model';

interface StreamMetrics {
  timestamp: number;
  currentTime: number;
  liveEdge: number;
  latency: number;
  bufferAhead: number;
  playbackRate: number;
  readyState: number;
}

interface StallEvent {
  timestamp: number;
  currentTime: number;
  latency: number;
  bufferAhead: number;
}

@Component({
  selector: 'app-stream-tester',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stream-tester">
      <h2>Stream Stability Tester</h2>

      <div class="controls">
        <select [(value)]="selectedChannelId" (change)="onChannelChange()">
          <option value="">Select a channel...</option>
          @for (channel of channels(); track channel.id) {
            <option [value]="channel.id">{{ channel.name }}</option>
          }
        </select>

        <button (click)="startTest()" [disabled]="isTesting() || !selectedChannelId()">
          {{ isTesting() ? 'Testing...' : 'Start Test' }}
        </button>

        <button (click)="stopTest()" [disabled]="!isTesting()">
          Stop
        </button>
      </div>

      <div class="metrics" [class.hidden]="!isTesting()">
        <div class="metric">
          <span class="label">Latency</span>
          <span class="value">{{ currentLatency().toFixed(1) }}s</span>
        </div>
        <div class="metric">
          <span class="label">Buffer</span>
          <span class="value">{{ currentBuffer().toFixed(1) }}s</span>
        </div>
        <div class="metric">
          <span class="label">Stalls</span>
          <span class="value">{{ stallCount() }}</span>
        </div>
        <div class="metric">
          <span class="label">Play Rate</span>
          <span class="value">{{ currentPlaybackRate().toFixed(2) }}x</span>
        </div>
        <div class="metric">
          <span class="label">Status</span>
          <span class="value" [class.buffering]="isBuffering()">&#9679;</span>
        </div>
      </div>

      <div class="report" [class.hidden]="!showReport()">
        <h3>Test Report</h3>
        <pre>{{ report() }}</pre>
      </div>

      <video #testVideo
             class="test-video"
             [class.hidden]="!isTesting()"
             autoplay
             muted></video>
    </div>
  `,
  styles: [`
    .stream-tester {
      padding: 1rem;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      width: 600px;
      max-width: 90vw;
    }
    .controls {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .controls select, .controls button {
      padding: 0.5rem;
      font-size: 1rem;
    }
    .metrics {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    .metric {
      text-align: center;
    }
    .metric .label {
      display: block;
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .metric .value {
      font-size: 1.25rem;
      font-weight: bold;
    }
    .metric .value.buffering {
      color: red;
    }
    .report {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
    }
    .report pre {
      white-space: pre-wrap;
      font-size: 0.75rem;
    }
    .test-video {
      width: 320px;
      height: 180px;
      margin-top: 1rem;
      background: black;
    }
    .hidden {
      display: none !important;
    }
  `]
})
export class StreamTesterComponent implements OnInit, OnDestroy {
  private readonly tvCatalogAdapter = inject(TvCatalogHttpAdapter);
  private readonly authSession = inject(AUTH_SESSION_PORT);
  private videoFacade: VideoPlaybackFacade | null = null;

  channels = signal<TvChannel[]>([]);
  selectedChannelId = signal<string>('');
  isTesting = signal(false);
  isBuffering = signal(false);
  currentLatency = signal(0);
  currentBuffer = signal(0);
  currentPlaybackRate = signal(1);
  stallCount = signal(0);
  showReport = signal(false);
  report = signal('');

  private hls: Hls | null = null;
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private metrics: StreamMetrics[] = [];
  private stalls: StallEvent[] = [];
  private testStartTime = 0;
  private lastCurrentTime = 0;

  @ViewChild('testVideo') testVideo!: HTMLVideoElement;

  async ngOnInit(): Promise<void> {
    await this.loadChannels();
  }

  ngOnDestroy(): void {
    this.stopTest();
  }

  private async loadChannels(): Promise<void> {
    try {
      const catalog = await this.tvCatalogAdapter.getCatalog();
      const allChannels = catalog.flatMap(cat => cat.channels);

      // Filter sports channels first
      const sportsChannels = allChannels.filter(ch =>
        ch.name.toLowerCase().includes('sport') ||
        ch.name.toLowerCase().includes('deport') ||
        ch.name.toLowerCase().includes('espn')
      );

      this.channels.set(sportsChannels.length > 0 ? sportsChannels : allChannels);
      console.log(`[StreamTester] Loaded ${this.channels().length} channels`);
    } catch (error) {
      console.error('[StreamTester] Failed to load channels:', error);
    }
  }

  async onChannelChange(): Promise<void> {
    this.showReport.set(false);
  }

  async startTest(): Promise<void> {
    const channelId = this.selectedChannelId();
    if (!channelId) return;

    const channel = this.channels().find(ch => ch.id === channelId);
    if (!channel) return;

    console.log(`[StreamTester] Starting test for: ${channel.name}`);
    console.log(`[StreamTester] Stream ID: ${channel.streamId}`);

    this.isTesting.set(true);
    this.showReport.set(false);
    this.metrics = [];
    this.stalls = [];
    this.stallCount.set(0);
    this.testStartTime = Date.now();
    this.lastCurrentTime = 0;

    // Wait for video element to be available
    setTimeout(() => this.initVideoPlayer(channel), 100);
  }

  private async initVideoPlayer(channel: TvChannel): Promise<void> {
    const video = document.querySelector('.test-video') as HTMLVideoElement;
    if (!video) {
      console.error('[StreamTester] Video element not found');
      this.isTesting.set(false);
      return;
    }

    try {
      // Get stream URL from API
      const credentials = this.authSession.retrieve();
      if (!credentials) {
        console.error('[StreamTester] No credentials found');
        this.isTesting.set(false);
        return;
      }

      const params = new URLSearchParams({
        username: credentials.user,
        password: credentials.password,
        stream: channel.streamId,
        type: 'live',
      });

      const response = await fetch(`${credentials.host}/player_api.php?${params}`);
      const data = await response.json();

      if (!data.stream_link) {
        console.error('[StreamTester] No stream link found');
        this.isTesting.set(false);
        return;
      }

      const streamUrl = data.stream_link;
      console.log(`[StreamTester] Stream URL obtained`);

      // Setup HLS
      if (Hls.isSupported()) {
        this.hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDuration: 40,
          liveMaxLatencyDuration: 60,
          liveDurationInfinity: true,
          maxBufferLength: 40,
          maxMaxBufferLength: 60,
          backBufferLength: 30,
          maxLiveSyncPlaybackRate: 1.05,
        });

        this.hls.on(Hls.Events.ERROR, (event, data) => {
          console.error(`[StreamTester] HLS Error: ${data.details}`, data);
          if (data.fatal) {
            this.generateReport();
          }
        });

        this.hls.on(Hls.Events.FRAG_BUFFERED, () => {
          this.collectMetrics(video);
        });

        this.hls.loadSource(streamUrl);
        this.hls.attachMedia(video);

        video.addEventListener('waiting', () => {
          this.isBuffering.set(true);
        });

        video.addEventListener('playing', () => {
          this.isBuffering.set(false);
        });

        video.addEventListener('stalled', () => {
          this.recordStall(video);
        });

        video.play().catch(e => {
          console.warn('[StreamTester] Autoplay blocked:', e.message);
        });

        // Start metrics collection
        this.metricsInterval = setInterval(() => {
          this.collectMetrics(video);
        }, 1000);

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = streamUrl;
        video.play().catch(e => {
          console.warn('[StreamTester] Autoplay blocked:', e.message);
        });

        this.metricsInterval = setInterval(() => {
          this.collectMetrics(video);
        }, 1000);
      }

    } catch (error) {
      console.error('[StreamTester] Error initializing player:', error);
      this.isTesting.set(false);
    }
  }

  private collectMetrics(video: HTMLVideoElement): void {
    if (video.readyState < 2) return;

    const currentTime = video.currentTime;
    const bufferedEnd = video.buffered.length > 0
      ? video.buffered.end(video.buffered.length - 1)
      : currentTime;
    const liveEdge = video.seekable.length > 0
      ? video.seekable.end(video.seekable.length - 1)
      : currentTime + 30;
    const latency = liveEdge - currentTime;
    const bufferAhead = bufferedEnd - currentTime;

    // Detect stall
    const timeSinceStart = Date.now() - this.testStartTime;
    if (timeSinceStart > 2000 && Math.abs(currentTime - this.lastCurrentTime) < 0.1 && !video.paused) {
      this.recordStall(video);
    }
    this.lastCurrentTime = currentTime;

    const sample: StreamMetrics = {
      timestamp: timeSinceStart,
      currentTime,
      liveEdge,
      latency,
      bufferAhead,
      playbackRate: video.playbackRate,
      readyState: video.readyState,
    };

    this.metrics.push(sample);
    this.currentLatency.set(latency);
    this.currentBuffer.set(bufferAhead);
    this.currentPlaybackRate.set(video.playbackRate);
  }

  private recordStall(video: HTMLVideoElement): void {
    const timeSinceStart = Date.now() - this.testStartTime;
    const bufferedEnd = video.buffered.length > 0
      ? video.buffered.end(video.buffered.length - 1)
      : video.currentTime;
    const liveEdge = video.seekable.length > 0
      ? video.seekable.end(video.seekable.length - 1)
      : video.currentTime + 30;

    const stall: StallEvent = {
      timestamp: timeSinceStart,
      currentTime: video.currentTime,
      latency: liveEdge - video.currentTime,
      bufferAhead: bufferedEnd - video.currentTime,
    };

    this.stalls.push(stall);
    this.stallCount.set(this.stalls.length);
    console.warn(`[StreamTester] Stall at ${(timeSinceStart / 1000).toFixed(1)}s`);
  }

  stopTest(): void {
    console.log('[StreamTester] Stopping test');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    const video = document.querySelector('.test-video') as HTMLVideoElement;
    if (video) {
      video.pause();
      video.src = '';
    }

    this.isTesting.set(false);
    this.generateReport();
  }

  private generateReport(): void {
    if (this.metrics.length === 0) {
      this.report.set('No metrics collected');
      this.showReport.set(true);
      return;
    }

    const duration = (Date.now() - this.testStartTime) / 1000;
    const avgLatency = this.metrics.reduce((sum, m) => sum + m.latency, 0) / this.metrics.length;
    const maxLatency = Math.max(...this.metrics.map(m => m.latency));
    const minLatency = Math.min(...this.metrics.map(m => m.latency));
    const avgBuffer = this.metrics.reduce((sum, m) => sum + m.bufferAhead, 0) / this.metrics.length;
    const minBuffer = Math.min(...this.metrics.map(m => m.bufferAhead));
    const avgPlaybackRate = this.metrics.reduce((sum, m) => sum + m.playbackRate, 0) / this.metrics.length;
    const stallCount = this.stalls.length;

    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration.toFixed(1)}s`,
      channel: this.selectedChannelId(),
      latency: {
        avg: `${avgLatency.toFixed(1)}s`,
        min: `${minLatency.toFixed(1)}s`,
        max: `${maxLatency.toFixed(1)}s`,
      },
      buffer: {
        avg: `${avgBuffer.toFixed(1)}s`,
        min: `${minBuffer.toFixed(1)}s (CRITICAL)`,
      },
      stalls: stallCount,
      playbackRate: avgPlaybackRate.toFixed(3),
      score: this.calculateScore(avgLatency, maxLatency, stallCount),
      config: {
        liveSyncDuration: 40,
        liveMaxLatencyDuration: 60,
        maxBufferLength: 40,
        maxLiveSyncPlaybackRate: 1.05,
      },
    };

    this.report.set(JSON.stringify(report, null, 2));
    this.showReport.set(true);

    console.group('[StreamTester] 📊 Test Report');
    console.log(`Duration: ${duration.toFixed(1)}s`);
    console.log(`Latency: avg=${avgLatency.toFixed(1)}s, min=${minLatency.toFixed(1)}s, max=${maxLatency.toFixed(1)}s`);
    console.log(`Buffer: avg=${avgBuffer.toFixed(1)}s, min=${minBuffer.toFixed(1)}s (CRITICAL)`);
    console.log(`Stalls: ${stallCount}`);
    console.log(`Score: ${report.score}/100`);
    console.groupEnd();

    // Save to localStorage for persistence
    try {
      const reports = JSON.parse(localStorage.getItem('stream-test-reports') || '[]');
      reports.push(report);
      if (reports.length > 10) reports.shift();
      localStorage.setItem('stream-test-reports', JSON.stringify(reports));
    } catch (e) {
      console.warn('[StreamTester] Could not save report');
    }
  }

  private calculateScore(avgLatency: number, maxLatency: number, stalls: number): number {
    let score = 100;

    if (avgLatency > 60) score -= 30;
    else if (avgLatency > 50) score -= 20;
    else if (avgLatency > 40) score -= 10;

    if (maxLatency > 90) score -= 20;
    else if (maxLatency > 70) score -= 10;

    score -= stalls * 5;

    return Math.max(0, score);
  }
}
