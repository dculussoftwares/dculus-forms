import { ImageResponse } from '@vercel/og';
import type { OgNode } from './element.js';
import { loadOgFonts } from './fonts.js';

/** Element tree → PNG bytes via @vercel/og (satori + resvg). */
export const renderPng = async (node: OgNode, size: { width: number; height: number }): Promise<Buffer> => {
  const response = new ImageResponse(node as any, { ...size, fonts: loadOgFonts() as any });
  return Buffer.from(await response.arrayBuffer());
};
