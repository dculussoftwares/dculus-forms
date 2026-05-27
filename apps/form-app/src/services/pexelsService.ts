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
