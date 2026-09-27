import app from '../server';

export default function handler(req: any, res: any) {
  // Restore original request path if rewritten or passed by Vercel
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-now-route-matches'] || req.url;
  if (matchedPath && typeof matchedPath === 'string' && matchedPath !== '/api/index' && matchedPath !== '/api/index/') {
    req.url = matchedPath;
  }
  return app(req, res);
}
