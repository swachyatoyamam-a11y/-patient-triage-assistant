import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { ApiError } from "@/utils/api-error";
import type { RegisterInput, LoginInput } from "@/validators/auth.validator";

const SALT_ROUNDS = 12;

function signToken(user: { id: string; role: string; email: string }) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/** Strips passwordHash before a user object ever leaves the service layer. */
function toPublicUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash: _omit, ...publicUser } = user;
  return publicUser;
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }

    if (input.role === "PATIENT" && (!input.dateOfBirth || !input.sex)) {
      throw ApiError.badRequest("Date of birth and sex are required for patient accounts");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // authProviderId is a placeholder until Clerk is wired end-to-end (see
    // "Auth architecture" in frontend/README.md — the frontend currently
    // calls this endpoint directly rather than going through Clerk). Once
    // Clerk is wired, Clerk issues the id and this service runs from a
    // webhook instead of this public route.
    const user = await prisma.user.create({
      data: {
        authProviderId: `local:${input.email}`,
        email: input.email,
        passwordHash,
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
        ...(input.role === "PATIENT" && {
          patientProfile: {
            create: {
              dateOfBirth: input.dateOfBirth!,
              sex: input.sex!,
            },
          },
        }),
      },
    });

    const token = signToken(user);
    return { user: toPublicUser(user), token };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.isActive || !user.passwordHash) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const token = signToken(user);
    return { user: toPublicUser(user), token };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { patientProfile: true, doctorProfile: true },
    });
    if (!user) throw ApiError.notFound("User not found");
    return toPublicUser(user);
  },
};
