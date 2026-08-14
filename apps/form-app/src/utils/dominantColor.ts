/**
 * Client-side dominant-color extraction for background media (image/video).
 * Computed once at apply-time and persisted on FormLayout.backgroundDominantColor,
 * never recomputed per render/visitor.
 */

const SAMPLE_SIZE = 50; // downscale target for canvas sampling — small enough to be fast, large enough to be representative
const BUCKET_STEP = 24; // quantization step per RGB channel for the histogram approach
const VIDEO_SEEK_TIMEOUT_MS = 5000;

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

type Bucket = { r: number; g: number; b: number; count: number };

/**
 * Buckets pixels by rounding each RGB channel to the nearest BUCKET_STEP. When
 * skipExtremes is set, near-white/near-black pixels are excluded — highlights,
 * shadows, and plain backdrops are common but don't represent "the image's color";
 * letting them dominate the pixel count produces a washed-out grey tint that visually
 * doesn't match the photo (the original complaint this scoring was tuned to fix).
 */
function buildBuckets(data: Uint8ClampedArray, skipExtremes: boolean): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (skipExtremes) {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 240 && min > 215) continue; // near-white
      if (max < 25) continue; // near-black
    }

    const key = `${Math.round(r / BUCKET_STEP)}-${Math.round(g / BUCKET_STEP)}-${Math.round(b / BUCKET_STEP)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  return buckets;
}

/**
 * Scores buckets by pixel count weighted toward saturation (chroma), so a moderately
 * sized vivid cluster (the actual subject) can outscore a much larger but dull cluster
 * (sky, pavement, a plain wall) — a pure frequency count picks the latter every time.
 */
function pickWinner(buckets: Map<string, Bucket>): Bucket | undefined {
  let winner: Bucket | undefined;
  let winnerScore = -Infinity;

  for (const bucket of buckets.values()) {
    const r = bucket.r / bucket.count;
    const g = bucket.g / bucket.count;
    const b = bucket.b / bucket.count;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b); // 0 (grey) .. 255 (fully saturated)
    const score = bucket.count * (1 + chroma / 255);
    if (score > winnerScore) {
      winnerScore = score;
      winner = bucket;
    }
  }

  return winner;
}

/**
 * Lightweight histogram-based "poor man's color-thief". Not a full k-means palette —
 * good enough for a tint wash.
 */
function computeDominantColor(data: Uint8ClampedArray): string {
  let buckets = buildBuckets(data, true);
  // Every pixel got filtered out (e.g. a near-pure white/black image) — fall back to
  // sampling unfiltered rather than returning nothing.
  if (buckets.size === 0) {
    buckets = buildBuckets(data, false);
  }

  const winner = pickWinner(buckets);
  if (!winner) return '';

  const r = winner.r / winner.count;
  const g = winner.g / winner.count;
  const b = winner.b / winner.count;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function sampleFromCanvasSource(source: CanvasImageSource): string {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return computeDominantColor(data);
}

/**
 * Samples the dominant color from an image blob. Uses a blob: URL (same-origin)
 * rather than the remote source URL directly, so canvas sampling never hits a
 * CORS-tainted-canvas SecurityError regardless of the source CDN's CORS policy.
 */
export async function computeDominantColorFromImageBlob(blob: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image for color sampling'));
      img.src = objectUrl;
    });
    return sampleFromCanvasSource(img);
  } catch {
    return '';
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Samples the dominant color from a video blob by seeking to a representative
 * frame (10% into the clip, to avoid black/blank opening frames) and drawing it
 * to canvas. The video element is briefly attached to the DOM (near-invisible) —
 * some browsers won't decode frames for an element that's never been in the document.
 */
export async function computeDominantColorFromVideoBlob(blob: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.style.position = 'absolute';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';

  try {
    document.body.appendChild(video);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for video metadata')), VIDEO_SEEK_TIMEOUT_MS);
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load video for color sampling'));
      };
      video.src = objectUrl;
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for video seek')), VIDEO_SEEK_TIMEOUT_MS);
      video.onseeked = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.currentTime = Math.min(1, (video.duration || 1) * 0.1);
    });

    return sampleFromCanvasSource(video);
  } catch {
    return '';
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.remove();
  }
}
