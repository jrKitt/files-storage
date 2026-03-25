import { NextResponse } from "next/server";
import {
  validateSession,
  verifyPassword,
  createSession,
  hasPassword,
  setPassword,
  destroySession,
  hasUsers,
  getSessionUser,
} from "@/lib/authStorage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, password, username } = body as {
      action?: string;
      password?: string;
      username?: string;
    };

    if (action === "check-password") {
      // Check if password is set
      const hasPass = await hasPassword();
      const userLoginMode = await hasUsers();
      return NextResponse.json({ hasPassword: hasPass, userLoginMode });
    }

    if (action === "set-password") {
      // Set initial password (only if no password exists)
      if (!password || typeof password !== "string" || password.trim() === "") {
        return NextResponse.json(
          { error: "Password is required" },
          { status: 400 }
        );
      }

      const hasPass = await hasPassword();
      if (hasPass) {
        return NextResponse.json(
          { error: "Password already set" },
          { status: 403 }
        );
      }

      await setPassword(password);
      const token = await createSession();
      
      const response = NextResponse.json({ success: true, token });
      response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return response;
    }

    if (action === "login") {
      // Login with password
      if (!password || typeof password !== "string") {
        return NextResponse.json(
          { error: "Password is required" },
          { status: 400 }
        );
      }

      const userLoginMode = await hasUsers();
      if (userLoginMode && (!username || typeof username !== "string" || username.trim() === "")) {
        return NextResponse.json(
          { error: "Username is required" },
          { status: 400 }
        );
      }

      const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : undefined;
      const isValid = await verifyPassword(password, normalizedUsername);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }

      const token = await createSession(normalizedUsername);
      
      const response = NextResponse.json({ success: true, token });
      response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
      });

      return response;
    }

    if (action === "logout") {
      const token = request.headers.get("x-auth-token") || "";
      if (token) {
        await destroySession(token);
      }

      const response = NextResponse.json({ success: true });
      response.cookies.delete("auth_token");
      return response;
    }

    if (action === "validate") {
      // Validate current session
      const token = request.headers.get("x-auth-token") || "";
      const isValid = await validateSession(token);
      const user = isValid ? await getSessionUser(token) : null;
      return NextResponse.json({ valid: isValid, user });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Auth API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
