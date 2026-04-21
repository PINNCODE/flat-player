/**
 * Stream Stability Tester
 *
 * Tests HLS stream stability by downloading segments and measuring latency.
 * Works without needing the channel list API - uses direct stream URLs.
 *
 * Usage:
 *   node scripts/stream-tester.mjs                           # Test default channel
 *   node scripts/stream-tester.mjs --stream-id 423307        # Specific stream ID
 *   node scripts/stream-tester.mjs --duration 120            # Run for 120 seconds
 *   node scripts/stream-tester.mjs --samples 10              # Collect 10 segment samples
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Credentials ────────────────────────────────────────────────────────────────
const CREDENTIALS = {
  host: 'https://ftvpro.net:8443',
  user: 'Trujillo2303',
  password: 'SAFJC4xWVRp5',
  defaultStreamId: '423307', // Known working stream
};

// ── Configuration ────────────────────────────────────────────────────────────────
const CONFIG = {
  testDurationSeconds: 60,
  segmentSamples: 10,
  segmentRetryAttempts: 3,
  timeout: 15000,
  streamId: '423307', // Known working stream ID
};

// ── State ──────────────────────────────────────────────────────────────────────
const metrics = {
  segmentTimes: [],
  stallCount: 0,
  errorCount: 0,
  startTime: 0,
  endTime: 0,
  config: { ...CONFIG },
};

// ── Stream URL ─────────────────────────────────────────────────────────────────
function getStreamUrl(streamId) {
  return `${CREDENTIALS.host}/live/${CREDENTIALS.user}/${CREDENTIALS.password}/${streamId}.m3u8`;
}

function getCurrentStreamUrl() {
  return `${CREDENTIALS.host}/live/${CREDENTIALS.user}/${CREDENTIALS.password}/${CONFIG.streamId}.m3u8`;
}

// ── Fetch with headers (required by server) ───────────────────────────────────
async function fetchWithHeaders(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': '*/*',
      'Referer': 'https://pinncode.github.io/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(CONFIG.timeout),
  });
  return response;
}

// ── Analyze Manifest ─────────────────────────────────────────────────────────────
async function analyzeManifest(streamUrl) {
  console.log('\n📋 Fetching HLS manifest...');

  const start = Date.now();
  const response = await fetchWithHeaders(streamUrl);
  const manifest = await response.text();
  const fetchTime = Date.now() - start;

  console.log(`   Manifest fetched in ${fetchTime}ms`);
  console.log(`   HTTP Status: ${response.status}`);

  const lines = manifest.split('\n');
  let targetDuration = 10;
  let mediaSequence = 0;
  let segmentCount = 0;
  const segments = [];
  const baseUrl = streamUrl.split('/').slice(0, -1).join('/');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDuration = parseInt(trimmed.split(':')[1], 10);
      console.log(`   Target Duration: ${targetDuration}s`);
    }
    if (trimmed.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      mediaSequence = parseInt(trimmed.split(':')[1], 10);
      console.log(`   Media Sequence: ${mediaSequence}`);
    }
    if (trimmed.endsWith('.ts') || trimmed.includes('.ts?')) {
      segmentCount++;
      const url = trimmed.startsWith('http')
        ? trimmed
        : `${streamUrl.split('/').slice(0, -1).join('/')}/${trimmed}`;
      segments.push(url);
    }
  }

  console.log(`   Segments in manifest: ${segmentCount}`);
  console.log(`   First few segments: ${segments.slice(0, 3).map(s => s.split('/').pop()).join(', ')}...`);

  return {
    targetDuration,
    mediaSequence,
    segmentCount,
    segments,
    fetchTime,
    baseUrl,
  };
}

// ── Measure Segment Download ─────────────────────────────────────────────────────
async function measureSegment(segmentUrl, index) {
  const timings = [];

  for (let attempt = 1; attempt <= CONFIG.segmentRetryAttempts; attempt++) {
    const start = Date.now();
    try {
      const response = await fetchWithHeaders(segmentUrl);
      const end = Date.now();
      const downloadTime = end - start;
      const size = parseInt(response.headers.get('content-length') || '0', 10);

      const timing = {
        index,
        attempt,
        success: true,
        latency: downloadTime,
        size,
        speed: size > 0 ? (size / (downloadTime / 1000) / 1024).toFixed(1) : 0,
        timestamp: Date.now() - metrics.startTime,
      };

      timings.push(timing);
      console.log(`   Segment ${index + 1}: ${downloadTime}ms | ${(size / 1024).toFixed(1)}KB | ${timing.speed} KB/s`);
      return timing;
    } catch (error) {
      console.log(`   Segment ${index + 1} (attempt ${attempt}): ❌ ${error.message}`);
      timings.push({
        index,
        attempt,
        success: false,
        error: error.message,
        latency: Date.now() - start,
        timestamp: Date.now() - metrics.startTime,
      });

      if (attempt < CONFIG.segmentRetryAttempts) {
        await new Promise(r => setTimeout(r, 500 * attempt)); // Exponential backoff
      }
    }
  }

  metrics.errorCount++;
  return timings[timings.length - 1];
}

// ── Continuous Segment Monitoring ─────────────────────────────────────────────────
async function monitorSegments(baseUrl, targetDuration) {
  console.log(`\n📡 Starting continuous segment monitoring for ${CONFIG.testDurationSeconds}s...`);
  console.log(`   Target segment duration: ${targetDuration}s`);
  console.log(`   Expected segments: ~${Math.ceil(CONFIG.testDurationSeconds / targetDuration)}`);

  const startTime = Date.now();
  const segmentTimings = [];
  let lastSequence = null;
  let stallCount = 0;

  while (Date.now() - startTime < CONFIG.testDurationSeconds * 1000) {
    try {
      // Fetch manifest to get current sequence
      const manifestResponse = await fetchWithHeaders(`${baseUrl}/index.m3u8`);
      const manifest = await manifestResponse.text();
      const lines = manifest.split('\n');

      let currentSequence = null;
      let latestSegmentUrl = null;

      for (const line of lines) {
        if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
          currentSequence = parseInt(line.split(':')[1], 10);
        }
        if (line.trim().endsWith('.ts') || line.trim().includes('.ts?')) {
          latestSegmentUrl = line.startsWith('http')
            ? line.trim()
            : `${baseUrl}/${line.trim()}`;
        }
      }

      // Detect stall (sequence not advancing)
      if (lastSequence !== null && currentSequence !== null) {
        if (currentSequence <= lastSequence) {
          stallCount++;
          console.log(`   ⚠️  Stall detected! Sequence: ${lastSequence} → ${currentSequence}`);
        }
      }
      lastSequence = currentSequence;

      if (latestSegmentUrl) {
        const timing = await measureSegment(latestSegmentUrl, segmentTimings.length);
        timing.sequence = currentSequence;
        segmentTimings.push(timing);
        metrics.segmentTimes.push(timing);
      }

      // Wait approximately one segment duration before next fetch
      await new Promise(r => setTimeout(r, targetDuration * 1000));

    } catch (error) {
      console.log(`   ❌ Manifest fetch error: ${error.message}`);
      metrics.errorCount++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { segmentTimings, stallCount };
}

// ── Generate Report ─────────────────────────────────────────────────────────────
function generateReport(manifestInfo, segmentTimings, stallCount) {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const successfulTimings = segmentTimings.filter(t => t.success);
  const failedTimings = segmentTimings.filter(t => !t.success);

  const avgLatency = successfulTimings.length > 0
    ? successfulTimings.reduce((sum, t) => sum + t.latency, 0) / successfulTimings.length
    : 0;

  const minLatency = successfulTimings.length > 0
    ? Math.min(...successfulTimings.map(t => t.latency))
    : 0;

  const maxLatency = successfulTimings.length > 0
    ? Math.max(...successfulTimings.map(t => t.latency))
    : 0;

  const avgSize = successfulTimings.length > 0
    ? successfulTimings.reduce((sum, t) => sum + (t.size || 0), 0) / successfulTimings.length
    : 0;

  const avgSpeed = avgSize > 0 && avgLatency > 0
    ? (avgSize / (avgLatency / 1000) / 1024).toFixed(1)
    : 0;

  // Calculate recommended buffer based on network performance
  const segmentDuration = manifestInfo.targetDuration;
  const downloadTimePerSegment = avgLatency / 1000; // seconds
  const segmentsNeededForBuffer = Math.ceil(downloadTimePerSegment / segmentDuration) + 2; // +2 for safety
  const recommendedBuffer = segmentsNeededForBuffer * segmentDuration;

  // Calculate network capacity
  const networkCapacity = avgSpeed > 0
    ? parseFloat(avgSpeed) / (segmentDuration * 1024) // segments per second
    : 0;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    STREAM TEST REPORT');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Stream URL:      ${CREDENTIALS.host}/live/${CREDENTIALS.user}/***/${CONFIG.streamId}.m3u8`);
  console.log(`  Test Duration:   ${duration.toFixed(1)}s`);
  console.log(`  Segments Tested: ${segmentTimings.length}`);
  console.log(`  Successful:      ${successfulTimings.length}`);
  console.log(`  Failed:          ${failedTimings.length}`);
  console.log(`  Stalls:          ${stallCount}`);
  console.log('');
  console.log('─────────────────── SEGMENT PERFORMANCE ──────────────────');
  console.log(`  Avg Latency:     ${avgLatency.toFixed(0)}ms`);
  console.log(`  Min Latency:     ${minLatency.toFixed(0)}ms`);
  console.log(`  Max Latency:     ${maxLatency.toFixed(0)}ms`);
  console.log(`  Avg Size:        ${(avgSize / 1024).toFixed(1)} KB`);
  console.log(`  Avg Speed:       ${avgSpeed} KB/s`);
  console.log('');
  console.log('─────────────────── BUFFER ANALYSIS ─────────────────────');
  console.log(`  Segment Duration: ${segmentDuration}s`);
  console.log(`  Network Capacity: ${networkCapacity.toFixed(2)} segments/s`);
  console.log(`  Segments Needed:  ${segmentsNeededForBuffer} (for stable buffer)`);
  console.log(`  Recommended Buffer: ${recommendedBuffer.toFixed(0)}s`);
  console.log('');
  console.log('─────────────────── CURRENT CONFIG ──────────────────────');
  console.log(`  liveSyncDuration:       40s`);
  console.log(`  liveMaxLatencyDuration: 60s`);
  console.log(`  maxBufferLength:        40s`);
  console.log('');
  console.log('─────────────────── RECOMMENDATIONS ────────────────────');
  if (recommendedBuffer > 50) {
    console.log(`  ⚠️  HIGH LATENCY DETECTED`);
    console.log(`     Network latency is very high. Consider:`);
    console.log(`     - Increase liveSyncDuration to ${Math.ceil(recommendedBuffer * 1.5)}s`);
    console.log(`     - Increase maxBufferLength to ${Math.ceil(recommendedBuffer * 2)}s`);
  } else if (recommendedBuffer > 30) {
    console.log(`  ⚠️  MODERATE-HIGH LATENCY`);
    console.log(`     Network can handle ~${networkCapacity.toFixed(2)} segments/s`);
    console.log(`     Current config of 40s buffer should work.`);
  } else {
    console.log(`  ✅ Network performance is good`);
    console.log(`     Buffer of ${recommendedBuffer.toFixed(0)}s should be sufficient`);
  }
  if (stallCount > 3) {
    console.log(`  ⚠️  STALLS DETECTED: ${stallCount}`);
    console.log(`     Consider increasing buffer sizes or checking network stability`);
  }
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    streamId: CONFIG.streamId,
    duration: duration.toFixed(1),
    segmentDuration,
    networkLatency: {
      avg: avgLatency.toFixed(0),
      min: minLatency.toFixed(0),
      max: maxLatency.toFixed(0),
    },
    throughput: {
      avgSpeed: avgSpeed,
      avgSizeKB: (avgSize / 1024).toFixed(1),
    },
    buffer: {
      recommendedSeconds: recommendedBuffer.toFixed(0),
      segmentsNeeded: segmentsNeededForBuffer,
      networkCapacityPerSecond: networkCapacity.toFixed(2),
    },
    stability: {
      stalls: stallCount,
      failedSegments: failedTimings.length,
      errorCount: metrics.errorCount,
    },
    config: {
      liveSyncDuration: 40,
      liveMaxLatencyDuration: 60,
      maxBufferLength: 40,
      maxMaxBufferLength: 60,
    },
    segmentTimings: segmentTimings.map(t => ({
      ...t,
      size: t.size ? `${(t.size / 1024).toFixed(1)}KB` : undefined,
    })),
  };

  const reportDir = join(__dirname, '../reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = join(reportDir, `stream-test-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: reports/stream-test-${Date.now()}.json`);

  // Machine-readable output
  console.log('\n[MACHINE_OUTPUT]');
  console.log(JSON.stringify({
    success: failedTimings.length === 0 && stallCount <= 3,
    avgLatencyMs: avgLatency.toFixed(0),
    recommendedBufferS: recommendedBuffer.toFixed(0),
    stalls: stallCount,
    score: calculateScore(avgLatency, stallCount, failedTimings.length, networkCapacity),
  }));

  return report;
}

function calculateScore(avgLatency, stalls, failed, networkCapacity) {
  let score = 100;

  // Latency penalty (target < 500ms for good performance)
  if (avgLatency > 1000) score -= 40;
  else if (avgLatency > 700) score -= 30;
  else if (avgLatency > 500) score -= 20;
  else if (avgLatency > 300) score -= 10;

  // Stall penalty
  score -= stalls * 8;

  // Failed segments penalty
  score -= failed * 5;

  // Network capacity penalty (need > 0.1 segments/s for stable playback)
  if (networkCapacity < 0.05) score -= 30;
  else if (networkCapacity < 0.1) score -= 15;

  return Math.max(0, Math.min(100, score));
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--stream-id' && args[i + 1]) {
      CONFIG.streamId = args[i + 1];
    } else if (args[i] === '--duration' && args[i + 1]) {
      CONFIG.testDurationSeconds = parseInt(args[i + 1], 10);
    } else if (args[i] === '--samples' && args[i + 1]) {
      CONFIG.segmentSamples = parseInt(args[i + 1], 10);
    } else if (args[i] === '--help') {
      console.log(`
Stream Stability Tester v1.0

Usage:
  node stream-tester.mjs [options]

Options:
  --stream-id <id>      Stream ID to test (default: ${CONFIG.streamId})
  --duration <secs>     Test duration in seconds (default: 60)
  --samples <n>         Number of segment samples (default: 10)
  --help                Show this help

Examples:
  node stream-tester.mjs
  node stream-tester.mjs --stream-id 423307 --duration 120
      `);
      process.exit(0);
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          STREAM STABILITY TESTER v1.0.0                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`\n🎬 Testing stream ID: ${CONFIG.streamId}`);
  console.log(`⏱️  Duration: ${CONFIG.testDurationSeconds}s`);

  metrics.startTime = Date.now();

  try {
    const streamUrl = getCurrentStreamUrl();
    const manifestInfo = await analyzeManifest(streamUrl);

    // Initial segment download test
    console.log('\n📊 Initial segment download test...');
    const initialSegments = manifestInfo.segments.slice(0, CONFIG.segmentSamples);
    const segmentTimings = [];

    for (let i = 0; i < initialSegments.length; i++) {
      const timing = await measureSegment(initialSegments[i], i);
      segmentTimings.push(timing);
      metrics.segmentTimes.push(timing);
    }

    // Continuous monitoring
    const { stallCount } = await monitorSegments(manifestInfo.baseUrl, manifestInfo.targetDuration);

    metrics.endTime = Date.now();
    generateReport(manifestInfo, segmentTimings, stallCount);

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    metrics.endTime = Date.now();
    process.exit(1);
  }
}

main();
