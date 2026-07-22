import { uploadFileHTTP } from './fileUploadService';
import { getApiBaseUrl } from '../lib/config';
import { computeDominantColorFromImageBlob, computeDominantColorFromVideoBlob } from '../utils/dominantColor';

interface PixabayImage {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  fullHDURL?: string;
  previewURL: string;
  tags: string;
  user: string;
  views: number;
  downloads: number;
  likes: number;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayImage[];
}

export async function searchPixabayImages(
  query: string = 'background',
  page: number = 1,
  perPage: number = 20
): Promise<PixabayResponse> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const response = await fetch(`${getApiBaseUrl()}/api/pixabay?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Image search error: ${response.status}`);
  }

  return response.json();
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

export async function downloadPixabayImage(
  imageUrl: string,
  formId: string
): Promise<BackgroundUploadResult> {
  // Fetch the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error('Failed to fetch image from Pixabay');
  }

  const imageBlob = await imageResponse.blob();
  const filename = `pixabay-${Date.now()}.jpg`;

  // Create a File object from the blob
  const file = new File([imageBlob], filename, { type: imageBlob.type });

  const [uploadResult, dominantColor] = await Promise.all([
    uploadFileHTTP(file, 'FormBackground', formId),
    computeDominantColorFromImageBlob(imageBlob).catch(() => ''),
  ]);

  return { ...uploadResult, dominantColor };
}

interface PixabayVideoRendition {
  url: string;
  width: number;
  height: number;
  size: number; // bytes
  thumbnail: string;
}

interface PixabayVideo {
  id: number;
  tags: string;
  duration: number;
  videos: {
    large: PixabayVideoRendition;
    medium: PixabayVideoRendition;
    small: PixabayVideoRendition;
    tiny: PixabayVideoRendition;
  };
  userImageURL: string;
  user: string;
  views: number;
  downloads: number;
  likes: number;
}

interface PixabayVideoResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideo[];
}

export async function searchPixabayVideos(
  query: string = 'background',
  page: number = 1,
  perPage: number = 20
): Promise<PixabayVideoResponse> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const response = await fetch(`${getApiBaseUrl()}/api/pixabay/videos?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Video search error: ${response.status}`);
  }

  return response.json();
}

const MAX_VIDEO_DOWNLOAD_BYTES = 45 * 1024 * 1024; // keep in sync with backend MAX_VIDEO_FILE_SIZE

// Picks the highest-quality rendition that fits under the upload cap — Pixabay reports
// an exact byte size per rendition, so we don't need to guess.
function selectBestVideoRendition(videos: PixabayVideo['videos']): PixabayVideoRendition {
  const renditions = [videos.large, videos.medium, videos.small, videos.tiny].filter(Boolean);
  return renditions.find((r) => r.size <= MAX_VIDEO_DOWNLOAD_BYTES) || renditions[renditions.length - 1];
}

export async function downloadPixabayVideo(
  video: PixabayVideo,
  formId: string
): Promise<BackgroundUploadResult> {
  const rendition = selectBestVideoRendition(video.videos);
  if (!rendition) {
    throw new Error('No downloadable video rendition found for this Pixabay video');
  }

  const videoResponse = await fetch(rendition.url);
  if (!videoResponse.ok) {
    throw new Error('Failed to fetch video from Pixabay');
  }

  const videoBlob = await videoResponse.blob();
  const filename = `pixabay-${Date.now()}.mp4`;
  const file = new File([videoBlob], filename, { type: videoBlob.type || 'video/mp4' });

  const [uploadResult, dominantColor] = await Promise.all([
    uploadFileHTTP(file, 'FormBackground', formId),
    computeDominantColorFromVideoBlob(videoBlob).catch(() => ''),
  ]);

  return { ...uploadResult, dominantColor };
}

export type { PixabayImage, PixabayResponse, PixabayVideo, PixabayVideoResponse };
