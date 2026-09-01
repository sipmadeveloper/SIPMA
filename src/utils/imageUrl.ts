/**
 * Utility for normalizing and loading images from Google Drive, Local Server, and Base64
 * Ensures instant, smooth image rendering on all devices (mobile, desktop, multi-browser)
 */

export function extractDriveFileId(urlOrId?: string | null): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  // Already just an ID
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed) && !trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }

  // Matches: /file/d/ID, id=ID, /d/ID, drive.google.com/uc?id=ID, lh3.googleusercontent.com/d/ID
  const match = trimmed.match(/(?:\/file\/d\/|[?&]id=|\/d\/|drive\.google\.com\/uc\?export=view&id=)([a-zA-Z0-9_-]{20,})/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Returns a high-speed, direct CDN image URL suitable for <img> tags across any device
 */
export function normalizeImageUrl(url?: string | null, fallback?: string): string {
  if (!url) return fallback || '';
  const trimmed = url.trim();
  if (!trimmed) return fallback || '';

  // Base64 Data URLs and Object URLs render directly
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Google Drive URLs conversion to ultra-fast LH3 CDN
  const fileId = extractDriveFileId(trimmed);
  if (fileId && !fileId.startsWith('sample-') && !fileId.startsWith('SIPMA_')) {
    // lh3.googleusercontent.com/d/ provides ultra-fast direct image streaming from Google Drive
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // Local server paths
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/')) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Get fallback thumbnail or server proxy URL if direct Google CDN is blocked
 */
export function getDriveImageProxyUrl(urlOrId?: string | null): string {
  const fileId = extractDriveFileId(urlOrId);
  if (fileId && !fileId.startsWith('sample-') && !fileId.startsWith('SIPMA_')) {
    return `/api/drive/image/${fileId}`;
  }
  return normalizeImageUrl(urlOrId);
}

/**
 * Check if the document / image is a PDF
 */
export function isPdfDocument(doc: { mime_type?: string; file_name?: string; document_title?: string; drive_url?: string }): boolean {
  if (doc.mime_type === 'application/pdf') return true;
  if (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf')) return true;
  if (doc.document_title && doc.document_title.toLowerCase().includes('pdf')) return true;
  return false;
}
