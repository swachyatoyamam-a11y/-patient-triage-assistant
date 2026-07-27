/**
 * Central map of which route prefixes each role may access.
 * Middleware and any server-side guard should import from here rather than
 * hard-coding path checks, so role rules stay in one place.
 */
export const ROLE_ROUTE_PREFIXES = {
  PATIENT: ["/dashboard", "/assessment", "/appointments", "/reports"],
  NURSE: ["/clinical"],
  DOCTOR: ["/clinical"],
  ADMIN: ["/admin", "/clinical"], // admins can also view the clinical queue
} as const;

export type AppRole = keyof typeof ROLE_ROUTE_PREFIXES;

export const PUBLIC_ROUTES = ["/", "/login/patient", "/login/staff", "/login/admin", "/signup"];
