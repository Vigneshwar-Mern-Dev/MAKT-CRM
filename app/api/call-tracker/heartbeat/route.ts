import { NextRequest, NextResponse } from "next/server";
import { authenticateCompanyPhone } from "@/app/lib/call-tracker";
import { db } from "@/app/lib/db";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { deviceId?: unknown };
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const token = getBearerToken(request);

  if (!deviceId || !token) {
    return NextResponse.json({ error: "deviceId and bearer token are required." }, { status: 400 });
  }

  const companyPhone = await authenticateCompanyPhone(deviceId, token);

  if (!companyPhone) {
    return NextResponse.json({ error: "Unauthorized device." }, { status: 401 });
  }

  await db.companyPhone.update({
    where: { id: companyPhone.id },
    data: { lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
}
