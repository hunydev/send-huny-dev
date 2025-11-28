import { Env } from '../types.ts';
import { handleAuthRoutes } from './auth.ts';
import { handleFileRoutes } from './files.ts';
import { handlePublicRoutes } from './public.ts';
import { corsHeaders, handleCors } from '../middleware/cors.ts';

export async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCors();
  }

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    let response: Response;

    // Route to appropriate handler
    if (path.startsWith('/api/auth/')) {
      response = await handleAuthRoutes(request, env, path);
    } else if (path.startsWith('/api/files')) {
      response = await handleFileRoutes(request, env, path);
    } else if (path.startsWith('/api/public/')) {
      response = await handlePublicRoutes(request, env, path);
    } else {
      response = new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}
