import app from '../server';

export default function handler(req: any, res: any) {
  // If request path was rewritten to /api/index by Vercel, restore original requested URL
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-now-route-matches'] || req.headers['x-forwarded-uri'];
  if (matchedPath && typeof matchedPath === 'string' && (req.url === '/api/index' || req.url === '/api/index/' || req.url.startsWith('/api/index?'))) {
    const queryIdx = req.url.indexOf('?');
    const query = queryIdx !== -1 ? req.url.slice(queryIdx) : '';
    req.url = matchedPath + query;
  }
  return app(req, res);
}

