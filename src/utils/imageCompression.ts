import heic2any from 'heic2any';

export const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB selection limit
export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB server upload ceiling
const TARGET_AVATAR_DIMENSION = 512;
const TARGET_MAX_BYTES = 100 * 1024; // ~50-100 KB WebP target

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

export interface ProcessedAvatarResult {
  blob: Blob;
  previewUrl: string;
  sizeBytes: number;
}

function isHeicFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

function isSupportedImageFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (mime && ACCEPTED_MIME_TYPES.has(mime)) {
    return true;
  }
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

async function decodeImageSource(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unsupported file type or corrupted image.'));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Your browser could not encode this image to WebP.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
}

export async function processAvatarImage(file: File): Promise<ProcessedAvatarResult> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Unsupported file type. Please choose a JPG, PNG, WebP, or HEIC image.');
  }

  if (file.size > MAX_AVATAR_INPUT_BYTES) {
    throw new Error('File is too large. Please choose an image under 10 MB.');
  }

  let workingBlob: Blob = file;

  if (isHeicFile(file)) {
    try {
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9,
      });
      workingBlob = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      // Fallback: let browser try native decoding if OS supports HEIC (e.g., macOS Safari)
      workingBlob = file;
    }
  }

  const img = await decodeImageSource(workingBlob);
  if (!img.width || !img.height) {
    throw new Error('Selected image has invalid dimensions.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = TARGET_AVATAR_DIMENSION;
  canvas.height = TARGET_AVATAR_DIMENSION;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image processing is unavailable in this browser.');
  }

  // Center-crop to a 1:1 square and resize to 512x512
  const squareSide = Math.min(img.width, img.height);
  const sx = Math.max(0, Math.floor((img.width - squareSide) / 2));
  const sy = Math.max(0, Math.floor((img.height - squareSide) / 2));

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    sx,
    sy,
    squareSide,
    squareSide,
    0,
    0,
    TARGET_AVATAR_DIMENSION,
    TARGET_AVATAR_DIMENSION
  );

  // Compress to WebP at ~0.8 quality, stepping down gently if needed to target <= 100 KB
  let quality = 0.8;
  let webpBlob = await canvasToWebpBlob(canvas, quality);

  while (webpBlob.size > TARGET_MAX_BYTES && quality > 0.45) {
    quality = Number((quality - 0.1).toFixed(2));
    webpBlob = await canvasToWebpBlob(canvas, quality);
  }

  if (webpBlob.size > MAX_AVATAR_UPLOAD_BYTES) {
    throw new Error('Processed image is still too large. Please try another photo.');
  }

  const previewUrl = URL.createObjectURL(webpBlob);
  return {
    blob: webpBlob,
    previewUrl,
    sizeBytes: webpBlob.size,
  };
}
