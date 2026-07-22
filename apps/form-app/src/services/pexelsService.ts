import { uploadFileHTTP } from './fileUploadService';
import { getApiBaseUrl } from '../lib/config';

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
): Promise<UploadResult> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error('Failed to fetch image from Pexels');
  }

  const imageBlob = await imageResponse.blob();
  const filename = `pexels-${Date.now()}.jpg`;
  const file = new File([imageBlob], filename, { type: imageBlob.type || 'image/jpeg' });

  return uploadFileHTTP(file, 'FormBackground', formId);
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

export async function downloadPexelsVideo(
  video: PexelsVideo,
  formId: string
): Promise<UploadResult> {
  const videoFile = selectSmallestVideoFile(video.video_files);
  if (!videoFile) {
    throw new Error('No downloadable video file found for this Pexels video');
  }

  const videoResponse = await fetch(videoFile.link);
  if (!videoResponse.ok) {
    throw new Error('Failed to fetch video from Pexels');
  }

  const videoBlob = await videoResponse.blob();
  const filename = `pexels-${Date.now()}.mp4`;
  const file = new File([videoBlob], filename, { type: videoBlob.type || 'video/mp4' });

  return uploadFileHTTP(file, 'FormBackground', formId);
}
