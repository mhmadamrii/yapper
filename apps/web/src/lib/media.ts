import { env } from '@yapper/env/web';

export interface MediaUploadResult {
  objectKey: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

export interface MediaTransformOptions {
  width?: number;
  height?: number;
  // 'sm' = imgproxy smart crop (content-aware), 'ce' = plain center crop.
  gravity?: 'sm' | 'ce';
  quality?: number;
}

// Unsigned imgproxy URL — same trust model ImageKit's own /tr: URLs had
// (public convenience transforms, no per-request signing). imgproxy is
// restricted (IMGPROXY_ALLOWED_SOURCES) to only fetch from our own bucket.
export function mediaUrl(objectKey: string, opts: MediaTransformOptions = {}) {
  const segments = [
    opts.width !== undefined ? `w:${opts.width}` : null,
    opts.height !== undefined ? `h:${opts.height}` : null,
    opts.width !== undefined || opts.height !== undefined ? 'rs:fit' : null,
    opts.width !== undefined && opts.height !== undefined
      ? `g:${opts.gravity ?? 'ce'}`
      : null,
    `q:${opts.quality ?? 80}`,
  ].filter((segment): segment is string => segment !== null);

  return `${env.VITE_MEDIA_URL_ENDPOINT}/insecure/${segments.join('/')}/plain/s3://${env.VITE_MEDIA_S3_BUCKET}/${objectKey}`;
}

// MinIO doesn't inspect uploads the way ImageKit's API did, so we read
// width/height client-side before uploading.
function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read image dimensions for ${file.name}`));
    };
    img.src = url;
  });
}

// Uploads straight to the presigned MinIO URL — file bytes never touch our
// server, same property the old ImageKit client-upload flow had.
export async function uploadToStorage(
  file: File,
  uploadUrl: string,
  objectKey: string,
): Promise<MediaUploadResult> {
  const [dimensions, res] = await Promise.all([
    readImageDimensions(file),
    fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type },
      body: file,
    }),
  ]);

  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }

  return {
    objectKey,
    width: dimensions.width,
    height: dimensions.height,
    size: file.size,
    format: file.type.replace('image/', ''),
  };
}
