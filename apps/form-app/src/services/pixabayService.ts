import { uploadFileHTTP } from './fileUploadService';
import { getApiBaseUrl } from '../lib/config';

interface PixabayImage {
  id: number;
  webformatURL: string;
  largeImageURL: string;
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

export async function downloadPixabayImage(
  imageUrl: string,
  formId: string
): Promise<UploadResult> {
  // Fetch the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error('Failed to fetch image from Pixabay');
  }

  const imageBlob = await imageResponse.blob();
  const filename = `pixabay-${Date.now()}.jpg`;

  // Create a File object from the blob
  const file = new File([imageBlob], filename, { type: imageBlob.type });

  // Use the existing upload service
  const result = await uploadFileHTTP(file, 'FormBackground', formId);

  return result;
}

export type { PixabayImage, PixabayResponse };
