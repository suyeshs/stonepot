import { SessionManager } from './session';
import { RpcSessionManager } from './rpc-session';
import type { Env } from './types';

// Export both for Cloudflare Workers bindings
export { SessionManager };
export { RpcSessionManager };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    const url = new URL(request.url);

    // Extract session ID from URL
    // Expected: /session/{sessionId}/display or /session/{sessionId}/update or /session/{sessionId}/rpc
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[2];

    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }

    // Authenticate requests from Bun server (for /update and /rpc endpoints)
    if (url.pathname.includes('/update') || url.pathname.includes('/rpc')) {
      if (!authenticateRequest(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Determine which Durable Object to use based on the endpoint
    // Use RpcSessionManager for /rpc endpoints, SessionManager for legacy endpoints
    const useRpc = url.pathname.includes('/rpc');
    const id = useRpc
      ? env.RPC_SESSION_MANAGER.idFromName(sessionId)
      : env.SESSION_MANAGER.idFromName(sessionId);
    const stub = useRpc
      ? env.RPC_SESSION_MANAGER.get(id)
      : env.SESSION_MANAGER.get(id);

    // Construct request to forward to Durable Object
    const doUrl = new URL(request.url);
    if (url.pathname.includes('/display')) {
      doUrl.pathname = '/display';
    } else if (url.pathname.includes('/update')) {
      doUrl.pathname = '/update';
    } else if (url.pathname.includes('/state')) {
      doUrl.pathname = '/state';
    } else if (url.pathname.includes('/init')) {
      doUrl.pathname = '/init';
    } else if (url.pathname.includes('/rpc')) {
      doUrl.pathname = '/rpc';
    }

    // Forward to Durable Object
    const response = await stub.fetch(new Request(doUrl.toString(), request));

    // Add CORS headers to response
    return addCORSHeaders(response, env);
  }
};

function authenticateRequest(request: Request, env: Env): boolean {
  if (!env.AUTH_SECRET) {
    // If no auth secret is configured, allow all requests (development only)
    return true;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  return token === env.AUTH_SECRET;
}

function handleCORS(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin') || '*';
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || ['*'];

  const corsOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function addCORSHeaders(response: Response, env: Env): Response {
  // Don't modify WebSocket upgrade responses - they have special handling
  if (response.status === 101 || response.webSocket) {
    return response;
  }

  const headers = new Headers(response.headers);

  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const corsOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins[0];

  headers.set('Access-Control-Allow-Origin', corsOrigin);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
