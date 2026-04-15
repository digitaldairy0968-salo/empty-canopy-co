// Cache auth image as base64 data URL in localStorage for instant rendering
const CACHE_KEY = 'auth_image_data_url';
const URL_KEY = 'auth_page_image_url';

let memoryCache: string | null = null;

export function getCachedAuthImage(): string | null {
  if (memoryCache) return memoryCache;
  const dataUrl = localStorage.getItem(CACHE_KEY);
  if (dataUrl) {
    memoryCache = dataUrl;
    return dataUrl;
  }
  // Fallback to URL-only cache
  return sessionStorage.getItem(URL_KEY) || null;
}

export async function fetchAndCacheAuthImage(): Promise<string | null> {
  // Return memory cache instantly
  if (memoryCache) return memoryCache;

  // Check localStorage for cached data URL
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

    const url = data.auth_page_image_url;
    sessionStorage.setItem(URL_KEY, url);

    // Convert to base64 data URL for instant future loads
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      localStorage.setItem(CACHE_KEY, dataUrl);
      memoryCache = dataUrl;
      return dataUrl;
    } catch {
      // If blob conversion fails, return the URL directly
      return url;
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

// Call this if admin updates the image
export function invalidateAuthImageCache() {
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem(URL_KEY);
}
