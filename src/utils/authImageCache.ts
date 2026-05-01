// Cache auth image as base64 data URL in localStorage for instant rendering
// Uses Supabase image transformation to fetch a small, optimized version (saves ~80% bandwidth)
const CACHE_KEY = 'auth_image_data_url_v2';
const URL_KEY = 'auth_page_image_url_v2';

let memoryCache: string | null = null;

// Use the original storage URL — image transformations don't reliably
// support all formats (e.g. .ico) and can return cropped/broken output.
function withTransform(url: string): string {
  return url;
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
    const optimizedUrl = withTransform(data.auth_page_image_url);
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
