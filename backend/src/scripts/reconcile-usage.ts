import mongoose, { Types } from 'mongoose';
import { env } from '../config/env.js';
import { Startup } from '../models/startup.model.js';
import { UsageRecord } from '../models/usage-record.model.js';

async function main() {
  const applyFix = process.argv.includes('--fix');
  await mongoose.connect(env.MONGODB_URI);

  try {
    const startups = await Startup.find({}).select('_id spendCommitted').lean();
    let driftCount = 0;

    for (const startup of startups) {
      const startupId = new Types.ObjectId(startup._id);
      const [row] = await UsageRecord.aggregate([
        { $match: { startupId, status: { $in: ['success', 'failed'] } } },
        { $group: { _id: null, ledgerPaise: { $sum: { $ifNull: ['$costAmount', 0] } } } },
      ]).exec() as Array<{ _id: null; ledgerPaise: number }>;

      const ledgerPaise = row?.ledgerPaise ?? 0;
      const counterPaise = startup.spendCommitted;
      if (counterPaise === ledgerPaise) continue;

      driftCount++;
      console.info(JSON.stringify({
        event: 'usage_reconciliation_drift',
        startupId: String(startup._id),
        counterPaise,
        ledgerPaise,
        driftPaise: ledgerPaise - counterPaise,
        fixRequested: applyFix,
      }));

      if (applyFix) {
        await Startup.updateOne({ _id: startup._id }, { $set: { spendCommitted: ledgerPaise } });
      }
    }

    console.info(JSON.stringify({
      event: 'usage_reconciliation_complete',
      startupsChecked: startups.length,
      driftCount,
      fixed: applyFix && driftCount > 0,
    }));

    if (driftCount > 0 && !applyFix) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async error => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'usage_reconciliation_failed',
    name: error instanceof Error ? error.name : 'UnknownError',
  }));
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
