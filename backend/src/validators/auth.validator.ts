import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

export const createStartupSchema = z.object({
  name: z.string().trim().min(1).max(80),
}).strict();
