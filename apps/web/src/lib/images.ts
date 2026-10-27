/** Longest edge we upload. Big enough for retina phones, small enough to keep uploads fast. */
const MAX_EDGE = 2048;

export type PreparedImage = { blob: Blob; width: number; height: number; previewUrl: string };

/**
 * Resizes a picked photo to at most 2048px on the long edge and re-encodes it as WebP in the browser
 * (canvas, no library). Strips metadata such as GPS location as a side effect.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/webp', 0.85),
  );
  return { blob, width, height, previewUrl: URL.createObjectURL(blob) };
}
