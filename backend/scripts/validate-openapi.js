import { openApiSpec } from '../src/docs-openapi.js';
const errors = [];
if (openApiSpec.openapi !== '3.0.3') errors.push('OpenAPI version must be 3.0.3');
if (!openApiSpec.info?.title || !openApiSpec.paths || !openApiSpec.components?.securitySchemes?.bearerAuth) errors.push('Missing required OpenAPI metadata, paths, or bearer security scheme');
for (const [path, item] of Object.entries(openApiSpec.paths)) {
  if (!path.startsWith('/api/')) errors.push(`Path must start with /api: ${path}`);
  for (const [method, operation] of Object.entries(item)) {
    if (!['get','post','put','patch','delete'].includes(method)) continue;
    if (!operation.summary || !operation.responses) errors.push(`Incomplete operation: ${method.toUpperCase()} ${path}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OpenAPI structural validation passed (${Object.keys(openApiSpec.paths).length} paths).`);
