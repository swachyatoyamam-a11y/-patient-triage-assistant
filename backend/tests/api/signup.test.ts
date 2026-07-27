import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
  },
}));

import { createApp } from "@/app";

const app = createApp();

// Fixed relative to "now" so the test doesn't rot as the calendar advances.
const now = new Date();
const validDateOfBirth = new Date(now.getFullYear() - 30, 0, 15).toISOString();

const validPayload = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  password: "password123",
  confirmPassword: "password123",
  phone: "+1-555-0100",
  dateOfBirth: validDateOfBirth,
  gender: "Female",
  medicalHistory: "Asthma",
  allergies: "Penicillin",
  emergencyContactName: "Charles Babbage",
  emergencyContactPhone: "+1-555-0101",
};

describe("POST /api/auth/signup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request missing required fields with 400", async () => {
    const res = await request(app).post("/api/auth/signup").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("rejects mismatched password/confirmPassword with 400", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validPayload, confirmPassword: "somethingElse123" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.confirmPassword?.[0]).toMatch(/passwords do not match/i);
  });

  it("rejects a date of birth in the future", async () => {
    const futureDob = new Date(now.getFullYear() + 1, 0, 15).toISOString();
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validPayload, dateOfBirth: futureDob });
    expect(res.status).toBe(400);
    expect(res.body.error.details.dateOfBirth?.[0]).toMatch(/cannot be in the future/i);
  });

  it("rejects signup when the email already exists", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "existing-user" });
    const res = await request(app).post("/api/auth/signup").send(validPayload);
    expect(res.status).toBe(409);
  });

  it("creates a new patient account and returns a token", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate.mockResolvedValueOnce({
      id: "new-patient-1",
      email: "ada@example.com",
      role: "PATIENT",
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: "hashed",
    });

    const res = await request(app).post("/api/auth/signup").send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET!) as { role: string };
    expect(decoded.role).toBe("PATIENT");

    // role must never be client-controlled on this endpoint
    const createArgs = mockUserCreate.mock.calls[0]![0];
    expect(createArgs.data.role).toBe("PATIENT");
    expect(createArgs.data.patientProfile.create.sex).toBe("Female");
    expect(createArgs.data.patientProfile.create.medicalHistory.create.allergies).toEqual(["Penicillin"]);
  });

  it("does not accept a client-supplied role", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate.mockResolvedValueOnce({
      id: "new-patient-2",
      email: "ada@example.com",
      role: "PATIENT",
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: "hashed",
    });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validPayload, role: "ADMIN" });

    expect(res.status).toBe(201);
    const createArgs = mockUserCreate.mock.calls[0]![0];
    expect(createArgs.data.role).toBe("PATIENT");
  });
});
