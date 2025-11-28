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
  const path = url.pathname;
  
  // For SPA routing: if it's not a file path (no extension), serve index.html
  const isFilePath = path.includes('.') && !path.endsWith('/');
  
  if (isFilePath) {
    // Try to serve the exact file
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }
  }
  
  // For non-file paths or 404s, serve index.html (SPA routing)
  const indexRequest = new Request(new URL('/index.html', url.origin), request);
  return env.ASSETS.fetch(indexRequest);
}
