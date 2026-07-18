import { env } from '@yapper/env/web';

export interface ImageKitUploadAuth {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
}

export interface ImageKitUploadResult {
  fileId: string;
  filePath: string;
  url: string;
  name: string;
  width: number;
  height: number;
  size: number;
  fileType: string;
}

export function imageKitUrl(filePath: string, transforms = 'f-auto,q-auto') {
  return `${env.VITE_IMAGEKIT_URL_ENDPOINT}/tr:${transforms}${filePath}`;
}

export async function uploadToImageKit(
  file: File,
  auth: ImageKitUploadAuth,
): Promise<ImageKitUploadResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('fileName', file.name);
  form.append('token', auth.token);
  form.append('expire', String(auth.expire));
  form.append('signature', auth.signature);
  form.append('publicKey', auth.publicKey);

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `Upload failed (${res.status})`);
  }

  return res.json() as Promise<ImageKitUploadResult>;
}
