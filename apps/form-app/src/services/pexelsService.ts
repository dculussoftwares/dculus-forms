import { uploadFileHTTP, UploadError } from './fileUploadService';
import { getApiBaseUrl } from '../lib/config';
import { computeDominantColorFromImageBlob, computeDominantColorFromVideoBlob } from '../utils/dominantColor';

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large: string;
    large2x: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

export interface PexelsResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
}

interface UploadResult {
  key: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  type: string;
}

// dominantColor is sampled once here (client already has the fetched blob in hand)
// and persisted on FormLayout — never recomputed per render/visitor.
type BackgroundUploadResult = UploadResult & { dominantColor: string };

export async function searchPexelsImages(
  query: string = 'background',
  page: number = 1,
  perPage: number = 15
): Promise<PexelsResponse> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const response = await fetch(`${getApiBaseUrl()}/api/pexels?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Image search error: ${response.status}`);
  }

  return response.json();
}

export async function downloadPexelsImage(
  imageUrl: string,
  formId: string
): Promise<BackgroundUploadResult> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error('Failed to fetch image from Pexels');
  }

  const imageBlob = await imageResponse.blob();
  const filename = `pexels-${Date.now()}.jpg`;
  const file = new File([imageBlob], filename, { type: imageBlob.type || 'image/jpeg' });

  const [uploadResult, dominantColor] = await Promise.all([
    uploadFileHTTP(file, 'FormBackground', formId),
    computeDominantColorFromImageBlob(imageBlob).catch(() => ''),
  ]);

  return { ...uploadResult, dominantColor };
}

export interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string; // thumbnail
  video_files: PexelsVideoFile[];
}

export interface PexelsVideoResponse {
  total_results: number;
  page: number;
  per_page: number;
  videos: PexelsVideo[];
  next_page?: string;
}

export async function searchPexelsVideos(
  query: string = 'background',
  page: number = 1,
  perPage: number = 15
): Promise<PexelsVideoResponse> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const response = await fetch(`${getApiBaseUrl()}/api/pexels/videos?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Video search error: ${response.status}`);
  }

  return response.json();
}

// Picks the smallest mp4 rendition at/above ~640px width, so the client-side
// fetch + re-upload to R2 stays small — falls back to the smallest rendition
// available if nothing meets that width.
function selectSmallestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  const mp4Files = files.filter((f) => f.file_type === 'video/mp4');
  const candidates = mp4Files.length > 0 ? mp4Files : files;
  const sorted = [...candidates].sort((a, b) => a.width - b.width);
  return sorted.find((f) => f.width >= 640) || sorted[0];
}

// Keep in sync with the backend's MAX_VIDEO_FILE_SIZE (fileUploadService.ts). Pexels doesn't
// report a byte size per rendition (unlike Pixabay), only width/height, so width is just a
// proxy for size — a long or high-bitrate clip at the chosen width can still exceed the cap.
// Checking the real blob size here avoids fetching-then-uploading a doomed multi-MB file only
// to have the backend reject it after the fact.
const MAX_VIDEO_DOWNLOAD_BYTES = 20 * 1024 * 1024;

export async function downloadPexelsVideo(
  video: PexelsVideo,
  formId: string
): Promise<BackgroundUploadResult> {
  const videoFile = selectSmallestVideoFile(video.video_files);
  if (!videoFile) {
    throw new Error('No downloadable video file found for this Pexels video');
  }

  const videoResponse = await fetch(videoFile.link);
  if (!videoResponse.ok) {
    throw new Error('Failed to fetch video from Pexels');
  }

  // Fast path: if the server tells us upfront it's oversized, fail before buffering
  // the whole body into memory (a slower streaming-abort would catch the rare case
  // where a CDN omits Content-Length, but that's not worth the complexity here).
  const contentLengthHeader = videoResponse.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  if (Number.isFinite(contentLength) && contentLength > MAX_VIDEO_DOWNLOAD_BYTES) {
    throw new UploadError(
      `Video size ${contentLength} bytes exceeds maximum allowed size of ${MAX_VIDEO_DOWNLOAD_BYTES} bytes`,
      'FILE_TOO_LARGE'
    );
  }

  const videoBlob = await videoResponse.blob();
  if (videoBlob.size > MAX_VIDEO_DOWNLOAD_BYTES) {
    throw new UploadError(
      `Video size ${videoBlob.size} bytes exceeds maximum allowed size of ${MAX_VIDEO_DOWNLOAD_BYTES} bytes`,
      'FILE_TOO_LARGE'
    );
  }

  const filename = `pexels-${Date.now()}.mp4`;
  const file = new File([videoBlob], filename, { type: videoBlob.type || 'video/mp4' });

  const [uploadResult, dominantColor] = await Promise.all([
    uploadFileHTTP(file, 'FormBackground', formId),
    computeDominantColorFromVideoBlob(videoBlob).catch(() => ''),
  ]);

  return { ...uploadResult, dominantColor };
}
