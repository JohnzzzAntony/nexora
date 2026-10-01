import bcrypt from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z.string().min(8, "Use at least 8 characters").max(128)
  .regex(/[a-zA-Z]/, "Include a letter").regex(/[0-9]/, "Include a number");

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
