import auth from '../modules/auth/routes/index.js';
import workspace from '../modules/workspace/routes/index.js';
import startup from '../modules/startup/routes/index.js';
import icp from '../modules/icp/routes/index.js';
import prospects from '../modules/prospects/routes/index.js';
import outreach from '../modules/outreach/routes/index.js';
import dashboard from '../modules/dashboard/routes/index.js';
import integrations from '../modules/integrations/routes/index.js';
import { trackRouter } from '../../../routeTracker.js';

export const modules = [
  { path: '/auth', router: trackRouter(auth, '/api/auth'), rateLimit: 'auth' },
  { path: '/workspace', router: trackRouter(workspace, '/api/workspace') },
  { path: '/startup', router: trackRouter(startup, '/api/startup') },
  { path: '/icp', router: trackRouter(icp, '/api/icp') },
  { path: '/prospects', router: trackRouter(prospects, '/api/prospects') },
  { path: '/outreach', router: trackRouter(outreach, '/api/outreach') },
  { path: '/', router: trackRouter(dashboard, '/api') },
  { path: '/', router: trackRouter(integrations, '/api') },
];

export function loadModules(app, limiters) {
  for (const module of modules) app.use(`/api${module.path}`, ...(module.rateLimit ? [limiters[module.rateLimit]] : []), module.router);
}
