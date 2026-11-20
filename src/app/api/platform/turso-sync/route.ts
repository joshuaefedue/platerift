import { NextRequest, NextResponse } from "next/server";
import { inspectTursoDatabase, syncWithTursoNow } from "@/lib/db";
import { authorizePlatformAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const authz = authorizePlatformAdmin(req);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    const status = await inspectTursoDatabase();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      {
        configured: false,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authz = authorizePlatformAdmin(req);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    const body = await req.json().catch(() => ({}));
    const direction =
      body.direction === "push" || body.direction === "pull"
        ? body.direction
        : "bidirectional";

    const syncResult = await syncWithTursoNow(direction);
    const status = await inspectTursoDatabase();

    return NextResponse.json({
      syncResult,
      status,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
