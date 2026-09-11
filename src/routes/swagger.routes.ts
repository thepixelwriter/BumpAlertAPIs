import { Router } from 'express';

const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'BumpAlert API',
    version: '0.1.0',
    description: 'Authentication and road anomaly reporting API for BumpAlert.',
  },
  servers: [
    { url: 'https://api.bumpalert.thepixelwriter.com', description: 'Production' },
    { url: 'http://localhost:8787', description: 'Local Wrangler development' },
  ],
  tags: [
    { name: 'Health', description: 'Service status' },
    { name: 'Authentication', description: 'Account and session operations' },
    { name: 'Reports', description: 'User-scoped road anomaly reports' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API health',
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Create an account',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          '201': { description: 'Account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '409': { description: 'Email is already registered' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in with email and password',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          '200': { description: 'Authenticated session', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/google': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in with a Google identity token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GoogleLoginRequest' } } } },
        responses: {
          '200': { description: 'Authenticated session', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '401': { description: 'Google authentication failed' },
        },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Request a password reset token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } } } },
        responses: { '200': { description: 'Reset request accepted' } },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Set a new password with a reset token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } } },
        responses: { '200': { description: 'Password updated' }, '400': { description: 'Invalid or expired token' } },
      },
    },
    '/api/reports': {
      get: {
        tags: ['Reports'],
        summary: 'List the authenticated user reports',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ReportStatus' } },
        ],
        responses: { '200': { description: 'Paginated reports' }, '401': { description: 'Authentication required' } },
      },
      post: {
        tags: ['Reports'],
        summary: 'Submit one or more anomaly reports',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReportSubmission' } } } },
        responses: { '201': { description: 'Reports created' }, '401': { description: 'Authentication required' } },
      },
    },
    '/api/reports/nearby': {
      get: {
        tags: ['Reports'],
        summary: 'List the authenticated user reports near a location',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lng', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'radiusMeters', in: 'query', schema: { type: 'number', minimum: 1, maximum: 50000, default: 2000 } },
        ],
        responses: { '200': { description: 'Nearby reports' }, '401': { description: 'Authentication required' } },
      },
    },
    '/api/reports/{id}': {
      get: {
        tags: ['Reports'],
        summary: 'Get one report',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Report details' }, '404': { description: 'Report not found' } },
      },
    },
    '/api/reports/{id}/status': {
      patch: {
        tags: ['Reports'],
        summary: 'Update a report status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusUpdateRequest' } } } },
        responses: { '200': { description: 'Status updated' }, '404': { description: 'Report not found' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      RegisterRequest: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string', minLength: 2, maxLength: 100 }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 128, format: 'password' } } },
      LoginRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } },
      GoogleLoginRequest: { type: 'object', required: ['credential'], properties: { credential: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, avatarUrl: { type: 'string', format: 'uri' } } },
      ForgotPasswordRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
      ResetPasswordRequest: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8, maxLength: 128, format: 'password' } } },
      AuthResponse: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } } },
      User: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, provider: { type: 'string' }, googleId: { type: 'string', nullable: true }, avatarUrl: { type: 'string', nullable: true } } },
      ReportStatus: { type: 'string', enum: ['pending', 'confirmed', 'dismissed', 'submitted'] },
      ReportSubmission: { type: 'object', required: ['submittedAt', 'hazards'], properties: { deviceId: { type: 'string' }, submittedAt: { type: 'integer' }, hazards: { type: 'array', minItems: 1, items: { $ref: '#/components/schemas/Hazard' } } } },
      Hazard: { type: 'object', required: ['latitude', 'longitude', 'timestamp', 'severity'], properties: { latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 }, timestamp: { type: 'integer' }, severity: { type: 'string', enum: ['moderate', 'severe', 'alarming'] }, gForce: { type: 'number', minimum: 0, maximum: 20 } } },
      StatusUpdateRequest: { type: 'object', required: ['status'], properties: { status: { $ref: '#/components/schemas/ReportStatus' } } },
    },
  },
};

const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BumpAlert API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>window.onload = () => SwaggerUIBundle({ url: '/api/swagger.json', dom_id: '#swagger-ui' });</script>
  </body>
</html>`;

export const swaggerRouter = Router();

swaggerRouter.get('/', (_req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://unpkg.com 'unsafe-inline'; style-src 'self' https://unpkg.com 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  res.type('html').send(swaggerHtml);
});

swaggerRouter.get('.json', (_req, res) => {
  res.json(openApiDocument);
});