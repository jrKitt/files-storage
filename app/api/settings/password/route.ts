import { NextResponse } from "next/server";
import { updateOwnPassword, validateSession } from "@/lib/authStorage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("x-auth-token") || "";
  const valid = await validateSession(token);

  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 }
      );
    }

    await updateOwnPassword({
      token,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
