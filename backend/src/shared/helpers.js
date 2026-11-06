import { z } from "zod";
import { db } from "../infrastructure/database/supabase.js";
import { HttpError } from "../core/errors/HttpError.js";


// Express 4 does not catch async errors; wrap every handler
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const parse = (schema, data) => {
  const p = schema.safeParse(data);
  if (!p.success) throw new HttpError(400, "Request validation failed", p.error.flatten().fieldErrors, "VALIDATION_ERROR");
  return p.data;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const assertUuid = (value, name) => {
  if (!UUID.test(String(value))) throw new HttpError(400, `Invalid ${name}`, undefined, "VALIDATION_ERROR");
};
export const uuidParams = (...names) => (req, _res, next) => {
  for (const n of names) if (req.params[n] && !UUID.test(req.params[n])) return next(new HttpError(400, `Invalid ${n}`, undefined, "VALIDATION_ERROR"));
  next();
};

// Throws a clean 500 on a Supabase error, otherwise returns data
export const ok = ({ data, error }, msg = "Database error") => {
  if (error) throw mapDatabaseError(error, msg);
  return data;
};

// Load a row only if it belongs to the caller's startup (tenant check)
export async function findOwned(table, id, startupId, select = "*") {
  const { data, error } = await db.from(table).select(select).eq("id", id).eq("startup_id", startupId).maybeSingle();
  if (error) throw mapDatabaseError(error, "Database error");
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

// Public re-export retained for feature route imports.
export { HttpError };

export function mapDatabaseError(error, fallback = "Database operation failed") {
  const code = error?.code;
  if (code === "23505") return new HttpError(409, "A record with these details already exists", undefined, "RESOURCE_CONFLICT");
  if (code === "PGRST116") return new HttpError(404, "Requested resource was not found", undefined, "RESOURCE_NOT_FOUND");
  if (code === "23503") return new HttpError(409, "This operation conflicts with related records", undefined, "FOREIGN_KEY_CONFLICT");
  if (code === "23502" || code === "22P02" || code === "PGRST102") return new HttpError(400, "Invalid database input", undefined, "VALIDATION_ERROR");
  if (["57014", "08000", "08003", "08006", "ECONNRESET", "ETIMEDOUT", "AbortError"].includes(code) || error?.name === "AbortError" || error?.name === "TimeoutError") return new HttpError(503, "Database temporarily unavailable. Please retry.", undefined, "DEPENDENCY_UNAVAILABLE");
  console.error(error);
  return new HttpError(500, fallback, undefined, "DATABASE_ERROR");
}
