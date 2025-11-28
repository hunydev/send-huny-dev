import { handleApiRequest } from './api/index.ts';
import { Env } from './types.ts';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle API requests
    if (path.startsWith('/api/')) {
      return handleApiRequest(request, env, ctx);
    }

    // Serve static assets (SPA)
    return serveStaticAssets(request, env, url);
  },
};

async function serveStaticAssets(request: Request, env: Env, url: URL): Promise<Response> {
  // Try to get the asset from the site bucket
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  
  // For SPA routing, always serve index.html for non-file paths
  const isFilePath = path.includes('.') && !path.endsWith('/');
  const assetPath = isFilePath ? path : '/index.html';
  
  try {
    // In production, this would use __STATIC_CONTENT
    // For now, we'll use a simple approach that works with wrangler
    const response = await env.__STATIC_CONTENT?.get(assetPath.slice(1));
    
    if (response) {
      const contentType = getContentType(assetPath);
      return new Response(response, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': isFilePath ? 'public, max-age=31536000' : 'no-cache',
        },
      });
    }
  } catch (e) {
    // Fall through to 404
  }

  // Fallback: return index.html for SPA routing
  try {
    const indexHtml = await env.__STATIC_CONTENT?.get('index.html');
    if (indexHtml) {
      return new Response(indexHtml, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  } catch (e) {
    // Fall through to 404
  }

  return new Response('Not Found', { status: 404 });
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
  };
  return types[ext || ''] || 'application/octet-stream';
}
