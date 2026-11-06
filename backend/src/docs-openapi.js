const protectedOp = (summary, tags, responses = {}) => ({
  summary, tags, security: [{ bearerAuth: [] }],
  responses: { '200': { description: 'Successful response' }, '400': { description: 'Validation error' }, '401': { description: 'Authentication required' }, '403': { description: 'Insufficient permissions' }, '500': { description: 'Server error' }, ...responses },
});
const publicOp = (summary, tags, responses = {}) => ({ ...protectedOp(summary, tags, responses), security: [] });
const jsonBody = (schema = { type: 'object', additionalProperties: true }) => ({ required: true, content: { 'application/json': { schema } } });

export const openApiSpec = {
  openapi: '3.0.3',
  info: { title: 'BlueCode OS Internal API', version: '1.0.0', description: 'Internal MVP API for BlueCode OS. Protected routes require a Bearer JWT. Tenant scope is derived from the authenticated token.' },
  servers: [
    { url: 'http://localhost:4000', description: 'Local development' },
    ...(process.env.STAGING_API_URL ? [{ url: process.env.STAGING_API_URL, description: 'Staging' }] : []),
    ...(process.env.PRODUCTION_API_URL ? [{ url: process.env.PRODUCTION_API_URL, description: 'Production' }] : []),
  ],
  tags: ['Health','Authentication','Workspace','Startup','ICP','Prospects','Outreach','Dashboard','Follow-ups','Usage','Integrations'].map(name => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Paste the JWT returned by POST /api/auth/login or register.' } },
    schemas: {
      Error: { type: 'object', required: ['success', 'error', 'code', 'requestId'], properties: { success: { type: 'boolean', example: false }, error: { type: 'string', example: 'Request validation failed' }, code: { type: 'string', example: 'VALIDATION_ERROR' }, details: { type: 'object' }, requestId: { type: 'string' } } },
      Credentials: { type: 'object', required: ['email','password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 128 } } },
    },
  },
  paths: {
    '/api/health': { get: publicOp('Liveness check', ['Health']) },
    '/api/ready': { get: publicOp('Readiness check including Supabase connectivity', ['Health'], { '503': { description: 'Dependency unavailable' } }) },
    '/api/auth/register': { post: { ...publicOp('Register user, startup workspace and trial', ['Authentication'], { '201': { description: 'Account created' }, '409': { description: 'Email already registered' } }), requestBody: jsonBody({ type: 'object', required: ['name','email','password'], properties: { name: { type: 'string', maxLength: 100 }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 128 } } }) } },
    '/api/auth/login': { post: { ...publicOp('Authenticate and issue JWT', ['Authentication'], { '401': { description: 'Invalid credentials' } }), requestBody: jsonBody({ $ref: '#/components/schemas/Credentials' }) } },
    '/api/auth/me': { get: protectedOp('Get current authenticated user', ['Authentication']) },
    '/api/workspace': { get: protectedOp('Load UI-compatible workspace', ['Workspace']), put: { ...protectedOp('Persist UI-compatible workspace snapshot', ['Workspace']), requestBody: jsonBody({ type: 'object', required: ['state'], properties: { state: { type: 'object' } } }) } },
    '/api/startup': { get: protectedOp('Get startup and subscription', ['Startup']), patch: { ...protectedOp('Update startup profile', ['Startup']), requestBody: jsonBody() } },
    '/api/icp': { get: protectedOp('Get current ICP', ['ICP']), put: { ...protectedOp('Create or update ICP', ['ICP']), requestBody: jsonBody() } },
    '/api/icp/approve': { post: protectedOp('Approve current ICP', ['ICP']) },
    '/api/prospects': { get: protectedOp('List prospects with filters and pagination', ['Prospects']), post: { ...protectedOp('Create prospects', ['Prospects']), requestBody: jsonBody() } },
    '/api/prospects/{id}': { get: protectedOp('Get prospect detail', ['Prospects']), patch: { ...protectedOp('Update prospect', ['Prospects']), requestBody: jsonBody() }, delete: protectedOp('Delete prospect', ['Prospects']) },
    '/api/prospects/{id}/signals': { put: { ...protectedOp('Replace prospect signals', ['Prospects']), requestBody: jsonBody() } },
    '/api/prospects/{id}/decision-makers': { get: protectedOp('List decision makers', ['Prospects']), post: { ...protectedOp('Add decision maker', ['Prospects']), requestBody: jsonBody() } },
    '/api/prospects/{id}/decision-makers/{dmId}': { patch: { ...protectedOp('Update decision maker', ['Prospects']), requestBody: jsonBody() }, delete: protectedOp('Delete decision maker', ['Prospects']) },
    '/api/outreach': { get: protectedOp('List outreach drafts', ['Outreach']), post: { ...protectedOp('Create outreach draft', ['Outreach']), requestBody: jsonBody() } },
    '/api/outreach/{id}': { patch: { ...protectedOp('Update draft', ['Outreach']), requestBody: jsonBody() }, delete: protectedOp('Delete draft', ['Outreach']) },
    '/api/outreach/{id}/approve': { post: protectedOp('Approve outreach draft; does not send email', ['Outreach']) },
    '/api/outreach/{id}/replies': { post: { ...protectedOp('Record and classify a pasted reply', ['Outreach']), requestBody: jsonBody() } },
    '/api/outreach/{id}/replies/{replyId}': { patch: { ...protectedOp('Update reply metadata and response draft', ['Outreach']), requestBody: jsonBody() } },
    '/api/outreach/{id}/follow-ups': { post: { ...protectedOp('Create follow-up record; does not send email', ['Follow-ups']), requestBody: jsonBody() } },
    '/api/follow-ups': { get: protectedOp('List follow-ups', ['Follow-ups']) },
    '/api/follow-ups/{id}': { patch: { ...protectedOp('Update follow-up', ['Follow-ups']), requestBody: jsonBody() }, delete: protectedOp('Delete follow-up', ['Follow-ups']) },
    '/api/dashboard': { get: protectedOp('Get dashboard counters and recent activity', ['Dashboard']) },
    '/api/activities': { get: protectedOp('Get activity feed', ['Dashboard']) },
    '/api/usage': { get: protectedOp('Get usage and subscription summary', ['Usage']) },
    '/api/integrations/status': { get: protectedOp('Get external integration configuration status', ['Integrations']) },
  },
};
