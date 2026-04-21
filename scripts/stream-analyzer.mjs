/**
 * Stream Analyzer - Simple HTTP-based stream analysis
 *
 * Analyzes HLS stream health without needing a browser.
 * Fetches the manifest and measures server response times.
 *
 * Usage:
 *   node scripts/stream-analyzer.mjs                           # Analyze random sports channel
 *   node scripts/stream-analyzer.mjs --channel "ESPN"          # Specific channel
 *   node scripts/stream-analyzer.mjs --samples 5                # Number of segment samples
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Credentials from package.json or environment ────────────────────────────────
const CREDENTIALS = {
  host: 'https://ftvpro.net:8443',
  user: 'Trujillo2303',
  password: 'SAFJC4xWVRp5',
};

// ── Configuration ───────────────────────────────────────────────────────────────
const CONFIG = {
  segmentSamples: 5,
  timeout: 10000,
};

// ── API Functions ──────────────────────────────────────────────────────────────
async function login() {
  console.log('\n🔐 Authenticating...');
  const params = new URLSearchParams({
    username: CREDENTIALS.user,
    password: CREDENTIALS.password,
  });

  const response = await fetch(`${CREDENTIALS.host}/player_api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();
  // This server returns { message: "username" } on success, not user_info.auth
  if (data.message === CREDENTIALS.user || data.user_info?.auth) {
    console.log('✅ Auth OK');
    return data;
  }
  throw new Error('Auth failed: ' + JSON.stringify(data));
}

async function getLiveStreams() {
  const params = new URLSearchParams({
    username: CREDENTIALS.user,
    password: CREDENTIALS.password,
    action: 'get_live_streams',
  });

  const response = await fetch(`${CREDENTIALS.host}/player_api.php?${params}`);
  return response.json();
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
  return data.stream_link;
}

async function measureRequest(url, label) {
  const timings = [];
  const errors = [];

  for (let i = 0; i < CONFIG.segmentSamples; i++) {
    const start = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(CONFIG.timeout),
      });
      const end = Date.now();
      const latency = end - start;

      timings.push({
        success: true,
        status: response.status,
        latency,
        size: parseInt(response.headers.get('content-length') || '0', 10),
        time: new Date().toISOString(),
      });

      console.log(`   ${label} #${i + 1}: ${latency}ms [${response.status}]`);
    } catch (error) {
      timings.push({
        success: false,
        error: error.message,
        latency: Date.now() - start,
        time: new Date().toISOString(),
      });
      errors.push(error.message);
      console.log(`   ${label} #${i + 1}: ❌ ${error.message}`);
    }
  }

  return { timings, errors };
}

async function analyzeManifest(manifestUrl) {
  console.log('\n📋 Fetching manifest...');
  const start = Date.now();

  try {
    const response = await fetch(manifestUrl, {
      signal: AbortSignal.timeout(CONFIG.timeout),
    });
    const manifest = await response.text();
    const fetchTime = Date.now() - start;

    console.log(`   Manifest fetched in ${fetchTime}ms`);

    const lines = manifest.split('\n');
    let targetDuration = 10;
    let mediaSequence = 0;
    let segmentCount = 0;
    const segments = [];

    for (const line of lines) {
      if (line.includes('EXT-X-TARGETDURATION')) {
        targetDuration = parseInt(line.split(':')[1], 10);
        console.log(`   Target Duration: ${targetDuration}s`);
      }
      if (line.includes('EXT-X-MEDIA-SEQUENCE')) {
        mediaSequence = parseInt(line.split(':')[1], 10);
        console.log(`   Media Sequence: ${mediaSequence}`);
      }
      if (line.includes('.ts') || line.includes('.m3u8')) {
        segmentCount++;
        const url = line.startsWith('http') ? line : manifestUrl.split('/').slice(0, -1).join('/') + '/' + line;
        segments.push(url);
      }
    }

    console.log(`   Segments in manifest: ${segmentCount}`);

    if (segments.length > 0) {
      console.log('\n📡 Measuring segment download times...');
      const segmentTimings = [];

      for (let i = 0; i < Math.min(segments.length, CONFIG.segmentSamples); i++) {
        const url = segments[i];
        const segStart = Date.now();
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(CONFIG.timeout),
          });
          const segEnd = Date.now();
          const downloadTime = segEnd - segStart;
          const size = parseInt(response.headers.get('content-length') || '0', 10);

          segmentTimings.push({
            index: i,
            url: url.substring(url.lastIndexOf('/') + 1),
            latency: segEnd - segStart,
            downloadTime,
            size,
            speed: size > 0 ? (size / (downloadTime / 1000) / 1024).toFixed(1) : 0,
          });

          console.log(`   Segment ${i + 1}: ${downloadTime}ms | ${(size / 1024).toFixed(1)}KB | ${segmentTimings[i].speed} KB/s`);
        } catch (error) {
          console.log(`   Segment ${i + 1}: ❌ ${error.message}`);
          segmentTimings.push({ index: i, error: error.message });
        }
      }

      const successfulTimings = segmentTimings.filter(t => t.downloadTime);
      if (successfulTimings.length > 0) {
        const avgDownload = successfulTimings.reduce((sum, t) => sum + t.downloadTime, 0) / successfulTimings.length;
        const avgSize = successfulTimings.reduce((sum, t) => sum + (t.size || 0), 0) / successfulTimings.length;
        const avgSpeed = avgSize > 0 ? (avgSize / (avgDownload / 1000) / 1024).toFixed(1) : 0;

        console.log(`\n   📊 Average segment: ${avgDownload.toFixed(0)}ms | ${(avgSize / 1024).toFixed(1)}KB | ${avgSpeed} KB/s`);
      }

      return {
        targetDuration,
        mediaSequence,
        segmentCount,
        segmentTimings,
        fetchTime,
      };
    }

    return { targetDuration, mediaSequence, segmentCount, fetchTime };
  } catch (error) {
    console.log(`   ❌ Failed to fetch manifest: ${error.message}`);
    return { error: error.message };
  }
}

// ── Channel Selection ──────────────────────────────────────────────────────────
function selectChannel(streams, selection) {
  if (selection === 'random') {
    const sports = streams.filter(s =>
      s.name.toLowerCase().includes('sport') ||
      s.name.toLowerCase().includes('deport') ||
      s.name.toLowerCase().includes('espn') ||
      s.name.toLowerCase().includes('fox')
    );
    const target = sports.length > 0 ? sports : streams;
    return target[Math.floor(Math.random() * target.length)];
  }

  const match = streams.find(s => s.name.toLowerCase().includes(selection.toLowerCase()));
  if (match) return match;

  console.log(`\n⚠️  Channel not found: "${selection}"`);
  console.log('   Available sports channels:');
  streams
    .filter(s => s.name.toLowerCase().includes('sport'))
    .slice(0, 5)
    .forEach(s => console.log(`   - ${s.name}`));

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let channelSelection = 'random';
  CONFIG.segmentSamples = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' && args[i + 1]) {
      channelSelection = args[i + 1];
    } else if (args[i] === '--samples' && args[i + 1]) {
      CONFIG.segmentSamples = parseInt(args[i + 1], 10);
    } else if (args[i] === '--help') {
      console.log(`
Stream Analyzer v1.0

Usage:
  node stream-analyzer.mjs [options]

Options:
  --channel <name>    Channel name to analyze (default: random sports)
  --samples <n>        Number of samples to collect (default: 5)
  --help               Show this help

Examples:
  node stream-analyzer.mjs
  node stream-analyzer.mjs --channel "ESPN" --samples 10
      `);
      process.exit(0);
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              STREAM ANALYZER v1.0.0                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    await login();
    const streams = await getLiveStreams();
    console.log(`\n📺 Found ${streams.length} streams`);

    const channel = selectChannel(streams, channelSelection);
    if (!channel) process.exit(1);

    console.log(`\n✅ Selected: ${channel.name}`);
    console.log(`   Category: ${channel.category_name}`);
    console.log(`   Stream ID: ${channel.stream_id}`);

    console.log('\n🔗 Getting stream URL...');
    const streamUrl = await getStreamUrl(channel.stream_id);

    if (!streamUrl) {
      throw new Error('Could not get stream URL');
    }
    console.log(`   URL: ${streamUrl.substring(0, 80)}...`);

    // Analyze the stream
    const manifestResult = await analyzeManifest(streamUrl);

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      ANALYSIS REPORT');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Channel:        ${channel.name}`);
    console.log(`  Category:       ${channel.category_name}`);
    console.log(`  Stream ID:      ${channel.stream_id}`);

    if (manifestResult.error) {
      console.log(`\n  ❌ Error: ${manifestResult.error}`);
    } else {
      console.log(`\n  📋 Manifest:`);
      console.log(`     Target Duration: ${manifestResult.targetDuration}s`);
      console.log(`     Segments: ${manifestResult.segmentCount}`);

      const segmentTimings = manifestResult.segmentTimings.filter(t => t.downloadTime);
      if (segmentTimings.length > 0) {
        const avgLatency = segmentTimings.reduce((sum, t) => sum + t.downloadTime, 0) / segmentTimings.length;
        const avgSize = segmentTimings.reduce((sum, t) => sum + (t.size || 0), 0) / segmentTimings.length;
        const avgSpeed = avgSize > 0 ? (avgSize / (avgLatency / 1000) / 1024) : 0;

        console.log(`\n  📊 Segment Performance (${segmentTimings.length} samples):`);
        console.log(`     Avg Latency: ${avgLatency.toFixed(0)}ms`);
        console.log(`     Avg Size: ${(avgSize / 1024).toFixed(1)} KB`);
        console.log(`     Avg Speed: ${avgSpeed.toFixed(1)} KB/s`);

        // Calculate buffer requirements
        const segmentDuration = manifestResult.targetDuration;
        const bufferNeeded = segmentDuration * 4; // 4 segments minimum
        const networkCapacity = (avgSpeed * 1000) / (segmentDuration * 1024); // segments per second

        console.log(`\n  📈 Buffer Analysis:`);
        console.log(`     Segment Duration: ${segmentDuration}s`);
        console.log(`     Recommended Buffer: ${bufferNeeded}s (${Math.ceil(bufferNeeded / segmentDuration)} segments)`);
        console.log(`     Network Capacity: ${networkCapacity.toFixed(2)} segments/s`);

        if (avgLatency > 500) {
          console.log(`\n  ⚠️  WARNING: High latency (${avgLatency.toFixed(0)}ms)`);
          console.log(`     Consider increasing liveSyncDuration and buffers`);
        }

        if (avgSpeed < 500) {
          console.log(`\n  ⚠️  WARNING: Low bandwidth (${avgSpeed.toFixed(1)} KB/s)`);
          console.log(`     May cause buffering with low latency settings`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');

    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      channel: channel.name,
      category: channel.category_name,
      streamId: channel.stream_id,
      manifestResult,
      config: CONFIG,
    };

    const reportPath = join(__dirname, `../reports/stream-analysis-${Date.now()}.json`);
    const { existsSync, mkdirSync, writeFileSync } = await import('fs');
    if (!existsSync(join(__dirname, '../reports'))) {
      mkdirSync(join(__dirname, '../reports'), { recursive: true });
    }
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: reports/stream-analysis-${Date.now()}.json`);

  } catch (error) {
    console.error(`\n❌ Analysis failed: ${error.message}`);
    process.exit(1);
  }
}

main();
