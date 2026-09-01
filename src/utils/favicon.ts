/**
 * Dynamic Favicon Updater Utility
 * Synchronizes browser tab favicon with central admin uploaded logo
 */

export function updateAppFavicon(logoUrl?: string | null): void {
  if (typeof document === 'undefined') return;

  try {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }

    let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.getElementsByTagName('head')[0].appendChild(appleLink);
    }

    if (logoUrl && logoUrl.trim().length > 0) {
      link.href = logoUrl;
      appleLink.href = logoUrl;
      if (logoUrl.startsWith('data:image/svg')) {
        link.type = 'image/svg+xml';
      } else if (logoUrl.startsWith('data:image/png')) {
        link.type = 'image/png';
      } else if (logoUrl.startsWith('data:image/jpeg') || logoUrl.startsWith('data:image/jpg')) {
        link.type = 'image/jpeg';
      }
    } else {
      // Default SVG green madrasah emblem favicon
      const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#065f46"/>
        <path d="M16 5L6 10V18C6 23.5 10.3 28.5 16 30C21.7 28.5 26 23.5 26 18V10L16 5Z" fill="#10b981"/>
        <path d="M16 8L8 12V17.5C8 22 11.4 26 16 27.5C20.6 26 24 22 24 17.5V12L16 8Z" fill="#047857"/>
        <path d="M16 11L19 16H13L16 11Z" fill="#fbbf24"/>
        <circle cx="16" cy="19" r="2.5" fill="#ffffff"/>
      </svg>`;
      const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(defaultSvg)}`;
      link.href = encoded;
      link.type = 'image/svg+xml';
      appleLink.href = encoded;
    }
  } catch (err) {
    console.error('Failed to update favicon:', err);
  }
}
