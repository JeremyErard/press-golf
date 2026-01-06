import { put, del } from '@vercel/blob';

// Supported image types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

// File size limit (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface UploadResult {
  url: string;
  pathname: string;
}

/**
 * Validates an image file
 */
export function validateImage(
  buffer: Buffer,
  mimeType: string,
  filename: string
): { valid: boolean; error?: string } {
  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: 'Image too large. Maximum size is 10MB.' };
  }

  // Check mime type
  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: 'Invalid image type. Supported: JPEG, PNG, WebP, GIF, HEIC.',
    };
  }

  // Check buffer is not empty
  if (buffer.length === 0) {
    return { valid: false, error: 'Empty file provided.' };
  }

  return { valid: true };
}

/**
 * Generates a unique filename with timestamp
 */
function generateFilename(originalName: string, prefix: string): string {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Uploads an avatar image to Vercel Blob
 */
export async function uploadAvatar(
  buffer: Buffer,
  filename: string,
  userId: string
): Promise<UploadResult> {
  const pathname = `avatars/${userId}/${generateFilename(filename, 'avatar')}`;

  const blob = await put(pathname, buffer, {
    access: 'public',
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Uploads a handicap proof image to Vercel Blob
 */
export async function uploadHandicapProof(
  buffer: Buffer,
  filename: string,
  userId: string
): Promise<UploadResult> {
  const pathname = `handicap-proofs/${userId}/${generateFilename(filename, 'proof')}`;

  const blob = await put(pathname, buffer, {
    access: 'public',
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Uploads a scorecard photo to Vercel Blob
 */
export async function uploadScorecardPhoto(
  buffer: Buffer,
  filename: string,
  roundId: string,
  playerId: string
): Promise<UploadResult> {
  const pathname = `scorecards/${roundId}/${generateFilename(filename, playerId)}`;

  const blob = await put(pathname, buffer, {
    access: 'public',
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Deletes an image from Vercel Blob
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    // Log but don't throw - deletion failures shouldn't block user flow
    console.error('Failed to delete blob:', url, error);
  }
}

/**
 * Extracts the pathname from a Vercel Blob URL for deletion
 */
export function getPathnameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Vercel Blob URLs include the pathname after the domain
    return urlObj.pathname.slice(1); // Remove leading slash
  } catch {
    return null;
  }
}
