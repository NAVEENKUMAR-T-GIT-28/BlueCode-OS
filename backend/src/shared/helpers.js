import { z } from "zod";
import { db } from "../infrastructure/database/supabase.js";
import { HttpError } from "../core/errors/HttpError.js";

export { HttpError };


// Express 4 does not catch async errors; wrap every handler
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const parse = (schema, data) => {
  const p = schema.safeParse(data);
  if (!p.success) throw new HttpError(400, "Invalid input", p.error.flatten().fieldErrors);
  return p.data;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const assertUuid = (value, name) => {
  if (!UUID.test(String(value))) throw new HttpError(400, `Invalid ${name}`);
};
export const uuidParams = (...names) => (req, _res, next) => {
  for (const n of names) if (req.params[n] && !UUID.test(req.params[n])) return next(new HttpError(400, `Invalid ${n}`));
  next();
};

// Throws a clean 500 on a Supabase error, otherwise returns data
export const ok = ({ data, error }, msg = "Database error") => {
  if (error) { console.error(error); throw new HttpError(500, msg); }
  return data;
};

// Load a row only if it belongs to the caller's startup (tenant check)
export async function findOwned(table, id, startupId, select = "*") {
  const { data, error } = await db.from(table).select(select).eq("id", id).eq("startup_id", startupId).maybeSingle();
  if (error) { console.error(error); throw new HttpError(500, "Database error"); }
  if (!data) throw new HttpError(404, "Not found");
  return data;
}

export const logActivity = (startupId, userId, title, detail = "", kind = "mail", prospectId = null) =>
  db.from("activities")
    .insert({ startup_id: startupId, user_id: userId, title, detail, kind, prospect_id: prospectId })
    .then(() => {}, () => {});

export const recordUsage = (startupId, userId, kind, units = 1, costInr = 0) =>
  db.from("usage_events")
    .insert({ startup_id: startupId, user_id: userId, kind, units, cost_inr: costInr })
    .then(() => {}, () => {});

export const uuid = z.string().uuid();
