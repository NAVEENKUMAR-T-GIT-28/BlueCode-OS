import { spawnSync } from 'node:child_process';
process.env.RUN_DB_INTEGRATION = 'true';
const result = spawnSync(process.execPath, ['--test', 'tests/tenant-isolation.integration.test.js'], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
