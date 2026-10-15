import { z } from "zod";

export const usernameSchema = z
  .string().trim().min(3, "Username must be at least 3 characters").max(32, "Username must be at most 32 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only");

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address"));

export const passwordSchema = z
  .string().min(10, "Password must be at least 10 characters").max(128, "Password must be at most 128 characters")
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), "Include upper-case, lower-case and a number");

export const signupSchema = z
  .object({ username: usernameSchema, email: emailSchema, password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const signinSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

