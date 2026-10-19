const credentialsSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email', example: 'ada@example.com' },
    password: { type: 'string', format: 'password', minLength: 6, example: 'correct-horse-battery' },
  },
};

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
};

const unauthorized = {
  description: 'Missing, malformed, invalid, or expired access token.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'FlyRank Task 4 - Supabase Auth API',
    version: '1.0.0',
    description:
      'Express API demonstrating Supabase Auth: email/password signup and login, JWT verification, protected routes, logout, and Swagger UI. Use the Authorize button with the access_token from /auth/login.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth', description: 'Account creation, login, and logout.' },
    { name: 'Public', description: 'No authentication required.' },
    { name: 'Protected', description: 'Requires a Supabase access token.' },
  ],
  paths: {
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        description:
          'Creates a Supabase Auth user with email and password. Email confirmation must be disabled in the Supabase project for login to work immediately.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Credentials' } },
          },
        },
        responses: {
          201: {
            description: 'Account created.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { user: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
          400: {
            description: 'Missing credentials, invalid input, or the email is already registered.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
          502: {
            description: 'Supabase Auth is unreachable.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        description: 'Exchanges email and password for a Supabase access token and refresh token.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Credentials' } },
          },
        },
        responses: {
          200: {
            description: 'Login succeeded. Use access_token as a Bearer token.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    token_type: { type: 'string', example: 'bearer' },
                    expires_in: { type: 'integer', example: 3600 },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Missing credentials.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
          401: {
            description: 'Invalid email/password combination.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
          502: {
            description: 'Supabase Auth is unreachable.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out',
        security: [{ bearerAuth: [] }],
        description: 'Revokes the caller’s Supabase session using the same bearer token.',
        responses: {
          204: { description: 'Session revoked. No response body.' },
          401: unauthorized,
          502: {
            description: 'Supabase Auth is unreachable.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        },
      },
    },
    '/public/info': {
      get: {
        tags: ['Public'],
        summary: 'Read public information',
        responses: {
          200: {
            description: 'Public payload.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    authenticated: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/protected/profile': {
      get: {
        tags: ['Protected'],
        summary: 'Read the current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Verified user metadata.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/User' } },
            },
          },
          401: unauthorized,
        },
      },
    },
    '/protected/dashboard': {
      get: {
        tags: ['Protected'],
        summary: 'Read the private dashboard',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Private dashboard payload.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: unauthorized,
        },
      },
    },
    '/protected/admin': {
      get: {
        tags: ['Protected'],
        summary: 'Admin-only route (stretch goal)',
        security: [{ bearerAuth: [] }],
        description: 'Returns 403 for a valid token whose app_metadata.role is not "admin".',
        responses: {
          200: {
            description: 'Authenticated and authorized admin.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: unauthorized,
          403: {
            description: 'Authenticated, but the user is not an admin.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Public'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Process is up.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the access_token returned by POST /auth/login.',
      },
    },
    schemas: {
      Credentials: credentialsSchema,
      User: userSchema,
      Error: errorSchema,
    },
  },
};
