"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken } from "@/lib/api-client";

type CurrentUser = { id: string; role: string; email: string };

/**
 * Decodes the JWT payload client-side purely for DISPLAY purposes (name/
 * role in a header, redirect targets). This is not a security boundary —
 * the token isn't verified here, only read. Actual access control happens
 * server-side in middleware.ts and on every backend route. Never gate a
 * sensitive UI action on this hook alone.
 */
function decodePayload(token: string): CurrentUser | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return { id: json.sub, role: json.role, email: json.email };
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const token = getToken();
    setUser(token ? decodePayload(token) : null);
    setLoaded(true);
  }, []);

  const logout = React.useCallback(() => {
    clearToken();
    router.push("/");
  }, [router]);

  return { user, loaded, logout };
}
