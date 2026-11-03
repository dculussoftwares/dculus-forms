import { toCanvas } from 'html-to-image';

export const THUMBNAIL_WIDTH = 1200;
export const THUMBNAIL_HEIGHT = 800;

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Screenshot a rendered form preview into a WebP file (PNG where the browser
 * can't encode WebP). Throws if the capture fails — e.g. a background image
 * served without CORS headers taints the canvas — so callers can fall back to
 * saving the template without a thumbnail.
 */
export async function captureTemplateThumbnail(node: HTMLElement, baseName: string): Promise<File> {
  const canvas = await toCanvas(node, {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    canvasWidth: THUMBNAIL_WIDTH,
    canvasHeight: THUMBNAIL_HEIGHT,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: '#ffffff',
  });

  let blob = await canvasToBlob(canvas, 'image/webp', 0.85);
  let extension = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, 'image/png', 1);
    extension = 'png';
  }
  if (!blob) throw new Error('Could not encode thumbnail');

  const safeName = baseName.replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'template';
  return new File([blob], `${safeName}-thumbnail.${extension}`, { type: blob.type });
}
