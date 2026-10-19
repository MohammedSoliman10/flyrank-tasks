import { createClient } from '@supabase/supabase-js';

/**
 * An error raised by the Supabase-backed auth adapter.
 *
 * Routes use `status` only to decide how to respond. Provider messages are not
 * returned verbatim for login failures, so the API does not reveal whether an
 * email exists.
 */
export class AuthError extends Error {
  constructor(message, { status = 500, code = 'auth_error' } = {}) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

function toAuthError(error) {
  if (error instanceof AuthError) return error;
  return new AuthError(error?.message || 'Authentication failed', {
    status: Number.isInteger(error?.status) ? error.status : 500,
    code: error?.code || 'auth_error',
  });
}

/**
 * Small adapter around supabase-js so the HTTP layer is easy to test.
 *
 * The client is created with the public anon key only. No service_role key is
 * used anywhere in this project.
 */
export function createSupabaseAuth({
  url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_KEY,
} = {}) {
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_KEY must be set. Copy .env.example to .env and fill in your project values.',
    );
  }

  const baseUrl = url.replace(/\/+$/, '');
  const client = createClient(baseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return {
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw toAuthError(error);
      if (!data?.user) throw new AuthError('Supabase did not return a user', { status: 502 });
      return data;
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw toAuthError(error);
      if (!data?.session || !data?.user) {
        throw new AuthError('Supabase did not return a session', { status: 502 });
      }
      return data;
    },

    async getUser(accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error) throw toAuthError(error);
      if (!data?.user) throw new AuthError('Supabase did not return a user', { status: 401 });
      return data.user;
    },

    /**
     * Invalidate the caller's Supabase session.
     *
     * supabase-js' browser `signOut()` signs out the session stored on its own
     * client. This API verifies a bearer token per request and stores no
     * session, so it calls the same GoTrue `/logout` endpoint the SDK uses and
     * passes the caller's JWT. That keeps logout stateless while still being a
     * real Supabase Auth operation.
     */
    async signOut(accessToken) {
      let response;
      try {
        response = await fetch(`${baseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (error) {
        throw new AuthError(`Could not reach Supabase Auth: ${error.message}`, {
          status: 503,
          code: 'auth_unreachable',
        });
      }

      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.json();
          detail = body?.msg || body?.message || body?.error_description || '';
        } catch {
          // The body may be empty (for example, a 502 from a proxy).
        }
        throw new AuthError(detail || `Supabase logout failed (${response.status})`, {
          status: response.status,
          code: 'logout_failed',
        });
      }
    },
  };
}
