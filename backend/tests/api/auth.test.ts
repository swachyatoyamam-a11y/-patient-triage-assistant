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

describe("POST /api/auth/register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request missing required fields with 400", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("rejects a patient registration missing dateOfBirth/sex", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/auth/register").send({
      email: "patient@example.com",
      password: "password123",
      firstName: "Test",
      lastName: "Patient",
      role: "PATIENT",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/date of birth/i);
  });

  it("rejects registration when the email already exists", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "existing-user" });
    const res = await request(app).post("/api/auth/register").send({
      email: "taken@example.com",
      password: "password123",
      firstName: "Test",
      lastName: "User",
      role: "PATIENT",
      dateOfBirth: "1990-01-01",
      sex: "Female",
    });
    expect(res.status).toBe(409);
  });

  it("rejects an anonymous request for a privileged role with 401", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "admin@example.com",
      password: "password123",
      firstName: "New",
      lastName: "Admin",
      role: "ADMIN",
    });
    expect(res.status).toBe(401);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("rejects a non-admin's request for a privileged role with 403", async () => {
    const nurseToken = jwt.sign(
      { sub: "nurse-1", role: "NURSE", email: "nurse@example.com" },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${nurseToken}`)
      .send({
        email: "admin@example.com",
        password: "password123",
        firstName: "New",
        lastName: "Admin",
        role: "ADMIN",
      });
    expect(res.status).toBe(403);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("lets an authenticated admin create a new admin account", async () => {
    const adminToken = jwt.sign(
      { sub: "admin-0", role: "ADMIN", email: "admin0@example.com" },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate.mockResolvedValueOnce({
      id: "new-user-1",
      email: "admin@example.com",
      role: "ADMIN",
      firstName: "New",
      lastName: "Admin",
      passwordHash: "hashed",
    });

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "admin@example.com",
        password: "password123",
        firstName: "New",
        lastName: "Admin",
        role: "ADMIN",
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    // passwordHash must never leave the service layer, even on the
    // account-creation response.
    expect(res.body.user.passwordHash).toBeUndefined();

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET!) as { role: string };
    expect(decoded.role).toBe("ADMIN");
  });
});

describe("GET /api/auth/me", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed/invalid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("accepts a validly signed token and returns the user", async () => {
    const token = jwt.sign(
      { sub: "user-1", role: "ADMIN", email: "admin@example.com" },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "admin@example.com",
      role: "ADMIN",
      firstName: "Admin",
      lastName: "User",
      passwordHash: "hashed",
    });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("admin@example.com");
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});
