// Image compression helper.
// Product & logo images are stored as base64 data-URLs directly in the database
// (products.image_url / restaurant_settings.logo_url). A raw phone photo is 3-5 MB,
// and getProducts() ships every row (with its embedded image) on each menu/POS/admin
// load — which is what blew up Supabase "Cached Egress". Compressing every upload to a
// small WebP data-URL before storing cuts each image ~50-100x and keeps that egress low.

interface CompressOptions {
  /** Longest edge in px the image is scaled down to (never scaled up). */
  maxSize?: number;
  /** WebP/JPEG quality between 0 and 1. */
  quality?: number;
  /** Output mime type. WebP keeps transparency (good for the logo) and compresses best. */
  mimeType?: 'image/webp' | 'image/jpeg';
}

/**
 * Reads an image File, resizes it so its longest edge is <= maxSize, and returns a
 * compressed base64 data-URL. Falls back to the original (uncompressed) data-URL if the
 * browser can't process it, so an upload never silently fails.
 */
export function compressImage(file: File, options: CompressOptions = {}): Promise<string> {
  const { maxSize = 800, quality = 0.72, mimeType = 'image/webp' } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const originalDataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(originalDataUrl); // can't decode -> keep original
      img.onload = () => {
        try {
          const longest = Math.max(img.width, img.height);
          const scale = longest > maxSize ? maxSize / longest : 1;
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(originalDataUrl);
          ctx.drawImage(img, 0, 0, w, h);

          const out = canvas.toDataURL(mimeType, quality);
          // Some browsers ignore WebP and return a PNG (larger). If the "compressed"
          // result somehow ends up bigger than the source, keep the smaller one.
          resolve(out && out.length < originalDataUrl.length ? out : originalDataUrl);
        } catch {
          resolve(originalDataUrl);
        }
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  });
}
