import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["PATIENT", "NURSE", "DOCTOR", "ADMIN"]).default("PATIENT"),
  // Patient-only fields, required when role === PATIENT (checked in service)
  dateOfBirth: z.coerce.date().optional(),
  sex: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

// Public self-registration for patients only — unlike registerSchema, role
// is never client-supplied, so this can't be used to mint a staff/admin
// account.
export const signupSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    phone: z.string().min(7, "Enter a valid phone number"),
    dateOfBirth: z.coerce.date({ errorMap: () => ({ message: "Enter a valid date of birth" }) }),
    gender: z.string().min(1, "Gender is required"),
    medicalHistory: z.string().optional(),
    allergies: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.dateOfBirth.getTime() <= Date.now(), {
    message: "Date of birth cannot be in the future",
    path: ["dateOfBirth"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
