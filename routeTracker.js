/**
 * routeTracker.js — Captures route metadata at registration time or inspection.
 */

export const endpoints = [];

export function trackRouter(router, basePath = '') {
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'all'];

  methods.forEach((method) => {
    const original = router[method];
    if (typeof original !== 'function') return;

    router[method] = function (path, ...handlers) {
      const lastHandler = handlers[handlers.length - 1];
      const action =
        typeof lastHandler === 'function' && lastHandler.name
          ? lastHandler.name
          : 'anonymous';

      const cleanBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      const cleanPath = path === '/' ? '' : path;
      const fullPath = `${cleanBase}${cleanPath}` || '/';

      endpoints.push({
        method: method.toUpperCase(),
        path: fullPath,
        action,
      });

      return original.call(this, path, ...handlers);
    };
  });

  return router;
}

