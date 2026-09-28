import app from '../server';

export default function handler(req: any, res: any) {
  // 1. Explicit query parameter from Vercel rewrite (?__vercel_route=/api/...)
  const rawUrl = req.url || '';
  const qIdx = rawUrl.indexOf('?');
  const queryStr = qIdx !== -1 ? rawUrl.slice(qIdx + 1) : '';
  const searchParams = new URLSearchParams(queryStr);
  const vercelRoute = searchParams.get('__vercel_route');

  if (vercelRoute) {
    searchParams.delete('__vercel_route');
    const rest = searchParams.toString();
    req.url = vercelRoute + (rest ? `?${rest}` : '');
    req.originalUrl = req.url;
  } else {
    // 2. Check headers fallback
    const xForwardedUri = req.headers['x-forwarded-uri'];
    const xOriginalUrl = req.headers['x-original-url'];
    const routeMatches = req.headers['x-now-route-matches'];
    const xMatchedPath = req.headers['x-matched-path'];

    if (xForwardedUri && typeof xForwardedUri === 'string' && (xForwardedUri.startsWith('/api') || xForwardedUri.startsWith('/uploads'))) {
      req.url = xForwardedUri;
      req.originalUrl = xForwardedUri;
    } else if (xOriginalUrl && typeof xOriginalUrl === 'string' && (xOriginalUrl.startsWith('/api') || xOriginalUrl.startsWith('/uploads'))) {
      req.url = xOriginalUrl;
      req.originalUrl = xOriginalUrl;
    } else if (routeMatches && typeof routeMatches === 'string') {
      const matchParams = new URLSearchParams(routeMatches);
      const matched = matchParams.get('match') || matchParams.get('1') || matchParams.get('path');
      if (matched) {
        const decoded = decodeURIComponent(matched).replace(/^\/+/, '');
        const query = qIdx !== -1 ? rawUrl.slice(qIdx) : '';
        req.url = `/api/${decoded}${query}`;
        req.originalUrl = req.url;
      }
    } else if (xMatchedPath && typeof xMatchedPath === 'string' && (xMatchedPath.startsWith('/api') || xMatchedPath.startsWith('/uploads')) && xMatchedPath !== '/api/index') {
      const query = qIdx !== -1 ? rawUrl.slice(qIdx) : '';
      req.url = xMatchedPath + query;
      req.originalUrl = req.url;
    }
  }

  return app(req, res);
}
