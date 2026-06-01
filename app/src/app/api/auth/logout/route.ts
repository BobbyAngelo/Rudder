import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("rudder_session", "", {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return response;
}
