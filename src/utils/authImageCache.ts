// Cache auth image as base64 data URL in localStorage for instant rendering
// Uses Supabase image transformation to fetch a small, optimized version (saves ~80% bandwidth)
const CACHE_KEY = 'auth_image_data_url';
const URL_KEY = 'auth_page_image_url';

let memoryCache: string | null = null;

// Append Supabase image transform params to dramatically shrink the download
// Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
function withTransform(url: string, width = 300, quality = 70): string {
  if (!url || !url.includes('/storage/v1/')) return url;
  // Convert /object/public/ to /render/image/public/ for transformations
  const transformedUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = transformedUrl.includes('?') ? '&' : '?';
  return `${transformedUrl}${sep}width=${width}&quality=${quality}`;
}

export function getCachedAuthImage(): string | null {
  if (memoryCache) return memoryCache;
  const dataUrl = localStorage.getItem(CACHE_KEY);
  if (dataUrl) {
    memoryCache = dataUrl;
    return dataUrl;
  }
  return sessionStorage.getItem(URL_KEY) || null;
}

export async function fetchAndCacheAuthImage(): Promise<string | null> {
  if (memoryCache) return memoryCache;

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    memoryCache = cached;
    return cached;
  }

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase
      .from('subscription_settings')
      .select('auth_page_image_url')
      .limit(1)
      .maybeSingle();

    if (!data?.auth_page_image_url) return null;

    // Use transformed URL — fetches a 300px wide, quality-70 version (~80% smaller)
    const optimizedUrl = withTransform(data.auth_page_image_url, 300, 70);
    sessionStorage.setItem(URL_KEY, optimizedUrl);

    try {
      const response = await fetch(optimizedUrl);
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      localStorage.setItem(CACHE_KEY, dataUrl);
      memoryCache = dataUrl;
      return dataUrl;
    } catch {
      return optimizedUrl;
    }
  } catch {
    return null;
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

export function invalidateAuthImageCache() {
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem(URL_KEY);
}
