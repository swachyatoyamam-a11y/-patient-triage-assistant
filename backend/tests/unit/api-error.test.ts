import { describe, it, expect } from "vitest";
import { ApiError } from "@/utils/api-error";

describe("ApiError", () => {
  it("factory methods set the expected status codes", () => {
    expect(ApiError.badRequest("x").statusCode).toBe(400);
    expect(ApiError.unauthorized().statusCode).toBe(401);
    expect(ApiError.forbidden().statusCode).toBe(403);
    expect(ApiError.notFound().statusCode).toBe(404);
    expect(ApiError.conflict("x").statusCode).toBe(409);
  });

  it("carries an optional details payload for validation-style errors", () => {
    const err = ApiError.badRequest("bad input", { field: "email" });
    expect(err.details).toEqual({ field: "email" });
  });

  it("default messages are sensible when none is given", () => {
    expect(ApiError.unauthorized().message).toMatch(/authentication/i);
    expect(ApiError.notFound().message).toMatch(/not found/i);
  });

  it("is a real Error instance with a stack trace", () => {
    const err = ApiError.forbidden();
    expect(err).toBeInstanceOf(Error);
    expect(err.stack).toBeDefined();
  });
});
