import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/lib/session";

// Pages can't change cookies while rendering, so the DAL sends a signed-in-but-deleted user here.
// Clearing the cookie stops the proxy bouncing /login back to / forever.
export async function GET(req: NextRequest) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login", req.nextUrl));
}
