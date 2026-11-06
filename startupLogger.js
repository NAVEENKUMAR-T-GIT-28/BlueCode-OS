/**
 * startupLogger.js
 * Displays a styled startup summary with a formatted route table
 * showing Controller, Method, Resource, and Path.
 * Uses zero-dependency ANSI escape codes for broad compatibility.
 */

// ANSI styles helper
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  blueBright: '\x1b[94m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  orange: '\x1b[38;5;214m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  black: '\x1b[30m',
};

const style = {
  cyanBold: (t) => `${c.bold}${c.cyan}${t}${c.reset}`,
  magentaBold: (t) => `${c.bold}${c.magenta}${t}${c.reset}`,
  blueBright: (t) => `${c.blueBright}${t}${c.reset}`,
  greenBold: (t) => `${c.bold}${c.green}${t}${c.reset}`,
  blueBold: (t) => `${c.bold}${c.blue}${t}${c.reset}`,
  yellowBold: (t) => `${c.bold}${c.yellow}${t}${c.reset}`,
  orangeBold: (t) => `${c.bold}${c.orange}${t}${c.reset}`,
  redBold: (t) => `${c.bold}${c.red}${t}${c.reset}`,
  whiteBold: (t) => `${c.bold}${c.white}${t}${c.reset}`,
  gray: (t) => `${c.gray}${t}${c.reset}`,
  badgeBlue: (t) => `${c.bgBlue}${c.white}${c.bold}${t}${c.reset}`,
  badgeGreen: (t) => `${c.bgGreen}${c.black}${c.bold}${t}${c.reset}`,
};

/**
 * Recursively inspect Express router / app stack to extract all registered routes.
 */
export function extractRoutes(app) {
  const routes = [];

  function printStack(stack, basePath = '') {
    if (!stack) return;

    for (const layer of stack) {
      if (layer.route) {
        const route = layer.route;
        const methods = Object.keys(route.methods).filter((m) => route.methods[m]);
        const fullPath = (basePath + (route.path === '/' && basePath !== '' ? '' : route.path)).replace(/\/+/g, '/');

        methods.forEach((method) => {
          routes.push({
            method: method.toUpperCase(),
            path: fullPath,
            action: route.stack?.[route.stack.length - 1]?.name || 'anonymous'
          });
        });
      } else if (layer.name === 'router' && layer.handle?.stack) {
        let mountPath = '';
        if (layer.regexp) {
          const match = layer.regexp.source
            .replace('^\\', '')
            .replace('\\/?(?=\\/|$)', '')
            .replace('?(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\^/g, '')
            .replace(/\$/g, '');
          if (match && !match.startsWith('(?=')) {
            mountPath = match;
          }
        }
        printStack(layer.handle.stack, `${basePath}/${mountPath}`.replace(/\/+/g, '/'));
      }
    }
  }

  if (app._router?.stack) {
    printStack(app._router.stack);
  }

  return routes;
}

export function printStartupSummary(app, config = {}) {
  const nodeEnv = config.nodeEnv || config.NODE_ENV || process.env.NODE_ENV || 'development';
  const port = config.port || config.PORT || process.env.PORT || 4000;
  const isDev = nodeEnv === 'development';
  const label = (text) => (isDev ? style.cyanBold(text) : text);

  console.log(
    '\n' +
      (isDev
        ? style.badgeBlue(' 🚀 BlueCode OS REST API Startup Summary ')
        : '🚀 BlueCode OS REST API Startup Summary') +
      '\n'
  );

  console.log(label('Environment:     ') + nodeEnv);
  console.log(label('Port:            ') + port);
  console.log(label('App URL:         ') + `http://localhost:${port}`);
  console.log(label('Docs URL:        ') + `http://localhost:${port}/reference`);
  console.log(label('Allowed Origins: ') + (process.env.CORS_ORIGINS || config.corsOrigins?.join(', ') || '*'));

  if (process.env.SUPABASE_URL) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const maskedUrl = supabaseUrl.replace(/^(https?:\/\/)([^.]+)(.*)$/, '$1***$3');
    console.log(label('Database:        ') + (isDev ? style.gray(maskedUrl) : '<configured>'));
  }

  console.log('\n' + (isDev ? style.badgeGreen(' Registered Routes ') : 'Registered Routes') + '\n');

  // Derive controller name from path for BlueCode OS
  const getController = (path) => {
    if (path.startsWith('/api/health') || path.startsWith('/api/ready')) return 'Health';
    if (path.startsWith('/api/auth')) return 'Auth';
    if (path.startsWith('/api/workspace')) return 'Workspace';
    if (path.startsWith('/api/startup')) return 'Startup';
    if (path.startsWith('/api/icp')) return 'ICP';
    if (path.startsWith('/api/prospects')) return 'Prospects';
    if (path.startsWith('/api/outreach')) return 'Outreach';
    if (path.startsWith('/api/dashboard') || path.startsWith('/api/activities') || path.startsWith('/api/follow-ups')) return 'Analytics';
    if (path.startsWith('/api/integrations') || path.startsWith('/api/hunter') || path.startsWith('/api/ai') || path.startsWith('/api/email') || path.startsWith('/api/payments')) return 'Integrations';
    return 'App';
  };

  const getResource = (path) => {
    const parts = path.split('/').filter(Boolean);
    return parts[1] || parts[0] || '';
  };

  const rawEndpoints = extractRoutes(app);

  // Group by controller
  const grouped = {};
  rawEndpoints.forEach((ep) => {
    if (ep.method === 'OPTIONS') return;
    const ctrl = getController(ep.path);
    if (!grouped[ctrl]) grouped[ctrl] = [];
    grouped[ctrl].push(ep);
  });

  const controllerOrder = [
    'Health',
    'Auth',
    'Startup',
    'Workspace',
    'ICP',
    'Prospects',
    'Outreach',
    'Analytics',
    'Integrations',
    'App'
  ];

  // Table dimensions
  const W = { sno: 6, ctrl: 16, method: 8, res: 16, path: 45 };

  const hr = `├${'─'.repeat(W.sno)}┼${'─'.repeat(W.ctrl)}┼${'─'.repeat(W.method)}┼${'─'.repeat(W.res)}┼${'─'.repeat(W.path)}┤`;
  const top = `┌${'─'.repeat(W.sno)}┬${'─'.repeat(W.ctrl)}┬${'─'.repeat(W.method)}┬${'─'.repeat(W.res)}┬${'─'.repeat(W.path)}┐`;
  const bot = `└${'─'.repeat(W.sno)}┴${'─'.repeat(W.ctrl)}┴${'─'.repeat(W.method)}┴${'─'.repeat(W.res)}┴${'─'.repeat(W.path)}┘`;

  const trim = (str, len) => (str.length > len ? str.slice(0, len - 3) + '...' : str);

  const printRow = (sno, ctrl, method, res, path) => {
    const sStr = trim(sno || '', W.sno - 2).padEnd(W.sno - 2);
    const cStr = trim(ctrl || '', W.ctrl - 2).padEnd(W.ctrl - 2);
    const mStr = trim((method || '').toUpperCase(), W.method - 2).padEnd(W.method - 2);
    const rStr = trim(res || '', W.res - 2).padEnd(W.res - 2);
    const pStr = trim(path || '', W.path - 2).padEnd(W.path - 2);

    const s = isDev ? style.gray(sStr) : sStr;
    const ctrlCol = isDev ? style.magentaBold(cStr) : cStr;
    const rCol = isDev ? style.cyanBold(rStr) : rStr;
    const pCol = isDev ? style.blueBright(pStr) : pStr;

    let mCol = mStr;
    if (isDev) {
      switch (method.toUpperCase()) {
        case 'GET': mCol = style.greenBold(mStr); break;
        case 'POST': mCol = style.blueBold(mStr); break;
        case 'PUT': mCol = style.yellowBold(mStr); break;
        case 'PATCH': mCol = style.orangeBold(mStr); break;
        case 'DELETE': mCol = style.redBold(mStr); break;
        default: mCol = style.whiteBold(mStr);
      }
    }

    console.log(`│ ${s} │ ${ctrlCol} │ ${mCol} │ ${rCol} │ ${pCol} │`);
  };

  console.log(top);
  printRow('S.No', 'Ctrl', 'Method', 'Resource', 'Path');
  console.log(hr);

  let counter = 1;
  let firstGroup = true;

  const allControllers = [
    ...controllerOrder,
    ...Object.keys(grouped).filter((k) => !controllerOrder.includes(k))
  ];

  allControllers.forEach((ctrl) => {
    if (!grouped[ctrl] || grouped[ctrl].length === 0) return;

    if (!firstGroup) console.log(hr);
    firstGroup = false;

    grouped[ctrl].forEach((ep) => {
      printRow(
        (counter++).toString() + '.',
        ctrl,
        ep.method,
        getResource(ep.path),
        ep.path
      );
    });
  });

  console.log(bot);

  const total = rawEndpoints.filter((e) => e.method !== 'OPTIONS').length;
  console.log(
    isDev
      ? style.gray(`\n  Total: ${total} endpoints\n`) +
          style.yellowBold(`  Visit API docs at http://localhost:${port}/reference\n`)
      : `\n  Registered Endpoints: ${total}\n`
  );
}
