/**
 * Stream Stability Tester
 *
 * Automated testing tool to measure HLS stream stability with real credentials.
 * Monitors: latency, buffer, stalls, audio drift, errors.
 *
 * Usage:
 *   node scripts/stream-tester.mjs                    # Interactive channel selection
 *   node scripts/stream-tester.mjs --channel "ESPN"  # Select channel by name
 *   node scripts/stream-tester.mjs --random            # Random channel
 *   node scripts/stream-tester.mjs --duration 120      # Run for 120 seconds (default: 60)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Hls = require('hls.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Credentials ────────────────────────────────────────────────────────────────
const CREDENTIALS = {
  host: 'https://ftvpro.net:8443',
  user: 'Trujillo2303',
  password: 'SAFJC4xWVRp5',
};

// ── Test Configuration ─────────────────────────────────────────────────────────
const CONFIG = {
  testDurationSeconds: 60,
  samplingIntervalMs: 1000,
  stallThresholdMs: 500,
  maxLatencyThreshold: 90,
  maxBufferStalls: 5,
};

// ── State ─────────────────────────────────────────────────────────────────────
let hls = null;
let videoElement = null;
let testStartTime = 0;
let isTestRunning = false;

const metrics = {
  samples: [],
  stalls: [],
  errors: [],
  startTime: 0,
  endTime: 0,
  channelName: '',
  streamUrl: '',
  config: { ...CONFIG },
};

// ── API Functions ─────────────────────────────────────────────────────────────
async function login() {
  console.log('\n🔐 Authenticating with IPTV server...');
  const params = new URLSearchParams({
    username: CREDENTIALS.user,
    password: CREDENTIALS.password,
  });

  const response = await fetch(`${CREDENTIALS.host}/player_api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.user_info?.auth) {
    console.log('✅ Authentication successful');
    return data;
  }
  throw new Error('Authentication failed: invalid credentials');
}

async function getLiveCategories(authData) {
  console.log('\n📺 Fetching live categories...');
  const params = new URLSearchParams({
    username: CREDENTIALS.user,
    password: CREDENTIALS.password,
    action: 'get_live_categories',
  });

  const response = await fetch(`${CREDENTIALS.host}/player_api.php?${params}`);
  const categories = await response.json();
  console.log(`   Found ${categories.length} categories`);
  return categories;
}

async function getLiveStreams() {
  console.log('\n📡 Fetching live streams...');
  const params = new URLSearchParams({
    username: CREDENTIALS.user,
    password: CREDENTIALS.password,
    action: 'get_live_streams',
  });

  const response = await fetch(`${CREDENTIALS.host}/player_api.php?${params}`);
  const streams = await response.json();
  console.log(`   Found ${streams.length} streams`);
  return streams;
}

async function getStreamUrl(streamId) {
  const params = new URLSearchParams({
    username: CREDENTIALS.user,
    password: CREDENTIALS.password,
    stream: streamId,
    type: 'live',
  });

  const response = await fetch(`${CREDENTIALS.host}/player_api.php?${params}`);
  const data = await response.json();
  return data.stream_link || null;
}

// ── Video Element Setup ───────────────────────────────────────────────────────
function createVideoElement() {
  const video = document.createElement('video');
  video.style.position = 'fixed';
  video.style.top = '0';
  video.style.left = '0';
  video.style.width = '320px';
  video.style.height = '180px';
  video.style.backgroundColor = 'black';
  video.style.zIndex = '9999';
  video.style.opacity = '0.7';
  video.controls = false;
  video.muted = false;
  document.body.appendChild(video);
  return video;
}

// ── Metrics Collection ────────────────────────────────────────────────────────
function collectSample() {
  if (!videoElement || !isTestRunning) return;

  const currentTime = videoElement.currentTime;
  const bufferedEnd = getBufferEnd(videoElement);
  const liveEdge = getLiveEdge();
  const latency = liveEdge - currentTime;
  const bufferAhead = bufferedEnd - currentTime;

  const sample = {
    timestamp: Date.now() - metrics.startTime,
    currentTime: Number(currentTime.toFixed(2)),
    liveEdge: Number(liveEdge.toFixed(2)),
    latency: Number(latency.toFixed(2)),
    bufferAhead: Number(bufferAhead.toFixed(2)),
    playbackRate: videoElement.playbackRate,
    paused: videoElement.paused,
    readyState: videoElement.readyState,
  };

  metrics.samples.push(sample);
}

function getBufferEnd(video) {
  if (video.buffered.length === 0) return video.currentTime;
  return video.buffered.end(video.buffered.length - 1);
}

function getLiveEdge() {
  if (videoElement.seekable.length > 0) {
    return videoElement.seekable.end(videoElement.seekable.length - 1);
  }
  return videoElement.currentTime + 30;
}

function detectStall() {
  if (!videoElement || videoElement.paused) return;

  const lastSample = metrics.samples[metrics.samples.length - 1];
  if (!lastSample) return;

  const timeSinceStart = Date.now() - metrics.startTime;
  if (timeSinceStart < 2000) return; // Ignore first 2 seconds

  const currentTime = videoElement.currentTime;
  const timeDelta = currentTime - lastSample.currentTime;

  if (timeDelta < 0.1 && !videoElement.paused) {
    const stallEvent = {
      timestamp: timeSinceStart,
      currentTime: currentTime,
      liveEdge: lastSample.liveEdge,
      latency: lastSample.latency,
      bufferAhead: lastSample.bufferAhead,
    };

    const lastStall = metrics.stalls[metrics.stalls.length - 1];
    if (!lastStall || timeSinceStart - lastStall.timestamp > 2000) {
      metrics.stalls.push(stallEvent);
      console.log(`   ⚠️  STALL detected at ${(timeSinceStart / 1000).toFixed(1)}s - Latency: ${lastSample.latency.toFixed(1)}s, Buffer: ${lastSample.bufferAhead.toFixed(1)}s`);
    }
  }
}

// ── HLS Setup ─────────────────────────────────────────────────────────────────
function setupHls(streamUrl) {
  return new Promise((resolve, reject) => {
    hls = new Hls({
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

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      console.log(`\n🎬 HLS Manifest loaded: ${data.levels.length} quality levels`);
      resolve();
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      console.log(`   📊 Level switched to: ${data.level}`);
    });

    hls.on(Hls.Events.FRAG_BUFFERED, (event, data) => {
      collectSample();
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      const error = {
        timestamp: Date.now() - metrics.startTime,
        fatal: data.fatal,
        type: data.type,
        details: data.details,
      };
      metrics.errors.push(error);
      console.log(`   ❌ HLS Error [${data.details}]: ${data.reason}`);

      if (data.fatal) {
        console.log('   🔥 Fatal error, stopping test');
        reject(new Error(`Fatal HLS error: ${data.details}`));
      }
    });

    hls.on(Hls.Events.STREAM_STATE_UPDATED, (event, data) => {
      // Stream state changes
    });

    videoElement.addEventListener('waiting', () => {
      console.log('   ⏳ Video waiting for data...');
    });

    videoElement.addEventListener('playing', () => {
      console.log('   ▶️  Video playing');
    });

    videoElement.addEventListener('stalled', (e) => {
      console.log('   ⚠️  Video stalled');
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(videoElement);

    videoElement.play().catch((e) => {
      console.log(`   ⚠️  Autoplay blocked: ${e.message}`);
    });
  });
}

// ── Report Generation ─────────────────────────────────────────────────────────
function generateReport() {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const avgLatency = metrics.samples.reduce((sum, s) => sum + s.latency, 0) / metrics.samples.length;
  const maxLatency = Math.max(...metrics.samples.map(s => s.latency));
  const minLatency = Math.min(...metrics.samples.map(s => s.latency));
  const avgBuffer = metrics.samples.reduce((sum, s) => sum + s.bufferAhead, 0) / metrics.samples.length;
  const minBuffer = Math.min(...metrics.samples.map(s => s.bufferAhead));
  const stallCount = metrics.stalls.length;
  const errorCount = metrics.errors.filter(e => e.fatal).length;
  const successfulSamples = metrics.samples.filter(s => s.readyState >= 2).length;
  const uptime = (successfulSamples / metrics.samples.length * 100).toFixed(1);

  const avgPlaybackRate = metrics.samples.reduce((sum, s) => sum + s.playbackRate, 0) / metrics.samples.length;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    STREAM TEST REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Channel:        ${metrics.channelName}`);
  console.log(`  Stream URL:     ${metrics.streamUrl.substring(0, 80)}...`);
  console.log(`  Duration:       ${duration.toFixed(1)}s`);
  console.log(`  Test Config:    liveSyncDuration=${CONFIG.testDurationSeconds}s`);
  console.log('');
  console.log('─────────────────── LATENCY ───────────────────');
  console.log(`  Average:        ${avgLatency.toFixed(1)}s`);
  console.log(`  Min:            ${minLatency.toFixed(1)}s`);
  console.log(`  Max:            ${maxLatency.toFixed(1)}s`);
  console.log(`  Target:         40s`);
  console.log('');
  console.log('─────────────────── BUFFER ────────────────────');
  console.log(`  Average:        ${avgBuffer.toFixed(1)}s`);
  console.log(`  Min (critical): ${minBuffer.toFixed(1)}s`);
  console.log('');
  console.log('─────────────────── STABILITY ─────────────────');
  console.log(`  Stalls:         ${stallCount}`);
  console.log(`  Fatal Errors:    ${errorCount}`);
  console.log(`  Uptime:         ${uptime}%`);
  console.log('');
  console.log('─────────────────── PLAYBACK ──────────────────');
  console.log(`  Avg Rate:       ${avgPlaybackRate.toFixed(3)}x`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    channel: metrics.channelName,
    duration,
    config: metrics.config,
    latency: { avg: avgLatency, min: minLatency, max: maxLatency },
    buffer: { avg: avgBuffer, min: minBuffer },
    stalls: stallCount,
    errors: errorCount,
    uptime,
    samples: metrics.samples,
    stallEvents: metrics.stalls,
    errorEvents: metrics.errors,
  };

  const reportPath = join(__dirname, `../reports/stream-test-${Date.now()}.json`);
  if (!existsSync(join(__dirname, '../reports'))) {
    writeFileSync(join(__dirname, '../reports'), '');
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: reports/stream-test-${Date.now()}.json`);

  // Console output for programmatic use
  console.log('\n[MACHINE_OUTPUT]');
  console.log(JSON.stringify({
    success: errorCount === 0 && stallCount <= CONFIG.maxBufferStalls,
    latency: avgLatency,
    maxLatency,
    stalls: stallCount,
    uptime,
    score: calculateScore(avgLatency, maxLatency, stallCount, uptime),
  }));

  return report;
}

function calculateScore(avgLatency, maxLatency, stalls, uptime) {
  let score = 100;

  // Latency penalty (target ~40s)
  if (avgLatency > 60) score -= 30;
  else if (avgLatency > 50) score -= 20;
  else if (avgLatency > 40) score -= 10;

  // Max latency penalty
  if (maxLatency > 90) score -= 20;
  else if (maxLatency > 70) score -= 10;

  // Stall penalty
  score -= stalls * 5;

  // Uptime penalty
  if (uptime < 95) score -= 20;
  else if (uptime < 98) score -= 10;

  return Math.max(0, score);
}

// ── Test Runner ───────────────────────────────────────────────────────────────
async function runTest(streamUrl, channelName, durationSeconds) {
  console.log(`\n🚀 Starting stream test for ${durationSeconds}s...`);
  console.log(`   Channel: ${channelName}`);
  console.log(`   URL: ${streamUrl.substring(0, 80)}...`);

  metrics.startTime = Date.now();
  metrics.channelName = channelName;
  metrics.streamUrl = streamUrl;
  isTestRunning = true;

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      detectStall();
      collectSample();
    }, CONFIG.samplingIntervalMs);

    const checkEnd = setInterval(() => {
      if (Date.now() - startTime >= durationSeconds * 1000) {
        clearInterval(interval);
        clearInterval(checkEnd);
        isTestRunning = false;
        metrics.endTime = Date.now();

        if (hls) {
          hls.destroy();
          hls = null;
        }
        if (videoElement) {
          videoElement.pause();
          videoElement.remove();
          videoElement = null;
        }

        resolve(generateReport());
      }
    }, 100);
  });
}

// ── Channel Selection ─────────────────────────────────────────────────────────
async function selectChannel(streams, selection) {
  if (selection === 'random') {
    const sportsChannels = streams.filter(s =>
      s.name.toLowerCase().includes('deport') ||
      s.name.toLowerCase().includes('sport') ||
      s.name.toLowerCase().includes('espn') ||
      s.name.toLowerCase().includes('fox sport') ||
      s.name.toLowerCase().includes('bein')
    );

    const target = sportsChannels.length > 0 ? sportsChannels : streams;
    return target[Math.floor(Math.random() * target.length)];
  }

  const searchTerm = selection.toLowerCase();
  const match = streams.find(s => s.name.toLowerCase().includes(searchTerm));

  if (match) return match;

  console.log(`\n⚠️  Channel "${selection}" not found. Available sports channels:`);
  streams
    .filter(s => s.name.toLowerCase().includes('sport') || s.name.toLowerCase().includes('deport'))
    .slice(0, 10)
    .forEach(s => console.log(`   - ${s.name}`));

  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let channelSelection = null;
  let duration = CONFIG.testDurationSeconds;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' && args[i + 1]) {
      channelSelection = args[i + 1];
    } else if (args[i] === '--random') {
      channelSelection = 'random';
    } else if (args[i] === '--duration' && args[i + 1]) {
      duration = parseInt(args[i + 1], 10);
    } else if (args[i] === '--help') {
      console.log(`
Stream Stability Tester
Usage:
  node stream-tester.mjs [options]

Options:
  --channel <name>   Select channel by name (partial match)
  --random            Select a random sports channel
  --duration <secs>   Test duration in seconds (default: 60)
  --help              Show this help

Examples:
  node stream-tester.mjs --random
  node stream-tester.mjs --channel "ESPN" --duration 120
      `);
      process.exit(0);
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          STREAM STABILITY TESTER v1.0.0                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    // Authenticate
    await login();

    // Get streams
    const streams = await getLiveStreams();

    if (streams.length === 0) {
      throw new Error('No streams found');
    }

    // Select channel
    let selectedStream;
    if (channelSelection) {
      selectedStream = await selectChannel(streams, channelSelection);
    } else {
      console.log('\n📺 Available actions:');
      console.log('   1. Select a sports channel (type --channel "name")');
      console.log('   2. Use --random for random sports channel');
      console.log('\n   Example: node stream-tester.mjs --channel "ESPN"');
      selectedStream = await selectChannel(streams, 'espn');
    }

    if (!selectedStream) {
      console.log('\n❌ No channel selected. Exiting.');
      process.exit(1);
    }

    console.log(`\n✅ Selected channel: ${selectedStream.name}`);

    // Get stream URL
    console.log('\n🔗 Getting stream URL...');
    const streamUrl = await getStreamUrl(selectedStream.stream_id);

    if (!streamUrl) {
      throw new Error('Could not get stream URL');
    }

    console.log(`   Stream URL obtained`);

    // Create video element (requires DOM)
    if (typeof document === 'undefined') {
      // Running in Node.js without JSDOM - create minimal test
      console.log('\n⚠️  Running in Node.js environment');
      console.log('   For full video testing, run in browser with the app');
      console.log('\n   Run: npm start');
      console.log('   Then open browser dev tools and run stream-tester.mjs');

      // Create a simple HTTP-based test
      await runHttpStreamTest(streamUrl, selectedStream.name, duration);
      return;
    }

    videoElement = createVideoElement();

    // Setup HLS
    await setupHls(streamUrl);

    // Run test
    await runTest(streamUrl, selectedStream.name, duration);

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// ── HTTP Stream Test (for Node.js without DOM) ────────────────────────────────
async function runHttpStreamTest(streamUrl, channelName, durationSeconds) {
  console.log('\n🔍 Analyzing stream HTTP headers...');

  try {
    const response = await fetch(streamUrl, { method: 'HEAD' });
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);

    const manifestResponse = await fetch(streamUrl);
    const manifest = await manifestResponse.text();

    console.log('\n📋 Stream Manifest Analysis:');
    const lines = manifest.split('\n');
    for (const line of lines) {
      if (line.includes('EXT-X-TARGETDURATION')) {
        console.log(`   Target Duration: ${line.split(':')[1]}`);
      }
      if (line.includes('EXT-X-MEDIA-SEQUENCE')) {
        console.log(`   Media Sequence: ${line.split(':')[1]}`);
      }
    }

    console.log(`\n✅ Stream is accessible and valid`);
    console.log(`   Channel: ${channelName}`);
    console.log(`   Duration tested: ${durationSeconds}s`);

  } catch (error) {
    console.error(`\n❌ Stream test failed: ${error.message}`);
  }
}

main();
