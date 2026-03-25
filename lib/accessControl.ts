import { NextResponse } from "next/server";
import { getSessionUser, type UserRole, validateSession } from "@/lib/authStorage";

export type AuthorizedContext = {
  token: string;
  role: UserRole;
};

export type AuthorizationResult =
  | { ok: true; context: AuthorizedContext }
  | { ok: false; response: NextResponse };

export async function assertAuthorized(
  request: Request,
  allowedRoles?: UserRole[]
): Promise<AuthorizationResult> {
  const token = request.headers.get("x-auth-token") || "";
  const isValid = await validateSession(token);

  if (!isValid) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Legacy single-password mode has no user account, treat it as admin.
  const sessionUser = await getSessionUser(token);
  const role: UserRole = sessionUser?.role || "admin";

  if (allowedRoles && !allowedRoles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    context: {
      token,
      role,
    },
  };
}
