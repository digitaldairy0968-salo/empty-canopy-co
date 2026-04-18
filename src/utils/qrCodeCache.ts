// Cache QR code image in localStorage as base64 to avoid repeated Supabase Storage downloads
const CACHE_KEY = 'qr_code_data_url';
const URL_KEY = 'qr_code_source_url';

let memoryCache: string | null = null;

function withTransform(url: string, width = 400, quality = 80): string {
  if (!url || !url.includes('/storage/v1/')) return url;
  const transformedUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = transformedUrl.includes('?') ? '&' : '?';
  return `${transformedUrl}${sep}width=${width}&quality=${quality}`;
}

export function getCachedQRCode(sourceUrl?: string | null): string | null {
  if (!sourceUrl) return null;
  // Invalidate if source URL changed (admin uploaded new QR)
  const cachedUrl = localStorage.getItem(URL_KEY);
  if (cachedUrl && cachedUrl !== sourceUrl) {
    invalidateQRCache();
  }
  if (memoryCache) return memoryCache;
  const dataUrl = localStorage.getItem(CACHE_KEY);
  if (dataUrl) {
    memoryCache = dataUrl;
    return dataUrl;
  }
  return null;
}

export async function fetchAndCacheQRCode(sourceUrl: string): Promise<string | null> {
  if (!sourceUrl) return null;

  const cachedUrl = localStorage.getItem(URL_KEY);
  if (cachedUrl !== sourceUrl) {
    invalidateQRCache();
  }

  if (memoryCache) return memoryCache;
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    memoryCache = cached;
    return cached;
  }

  try {
    const optimized = withTransform(sourceUrl, 400, 80);
    const response = await fetch(optimized);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    localStorage.setItem(CACHE_KEY, dataUrl);
    localStorage.setItem(URL_KEY, sourceUrl);
    memoryCache = dataUrl;
    return dataUrl;
  } catch {
    return sourceUrl;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function invalidateQRCache() {
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(URL_KEY);
}
