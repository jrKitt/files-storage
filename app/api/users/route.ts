import { NextResponse } from "next/server";
import {
  createUser,
  deleteUser,
  listUsers,
  setUserPasswordByAdmin,
} from "@/lib/authStorage";
import { assertAuthorized } from "@/lib/accessControl";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const users = await listUsers();
    return NextResponse.json(users);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      username?: string;
      displayName?: string;
      password?: string;
      role?: "admin" | "editor" | "viewer";
    };

    const user = await createUser({
      username: body.username || "",
      displayName: body.displayName || "",
      password: body.password || "",
      role: body.role,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      id?: string;
      newPassword?: string;
    };

    if (!body.id || !body.newPassword) {
      return NextResponse.json({ error: "id and newPassword are required" }, { status: 400 });
    }

    await setUserPasswordByAdmin(body.id, body.newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
