import { NextRequest, NextResponse } from "next/server";
import {
  registerCompanyPhone,
  validateRegistrationSecret,
} from "@/app/lib/call-tracker";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      registrationSecret?: unknown;
      companyPhone?: unknown;
      deviceId?: unknown;
      label?: unknown;
    };

    if (!validateRegistrationSecret(body.registrationSecret)) {
      return NextResponse.json({ error: "Unauthorized registration secret." }, { status: 401 });
    }

    if (typeof body.companyPhone !== "string" || typeof body.deviceId !== "string") {
      return NextResponse.json(
        { error: "companyPhone and deviceId are required." },
        { status: 400 },
      );
    }

    const result = await registerCompanyPhone({
      companyPhone: body.companyPhone,
      deviceId: body.deviceId,
      label: typeof body.label === "string" ? body.label : undefined,
    });

    return NextResponse.json({
      ok: true,
      companyPhone: {
        id: result.companyPhone.id,
        phoneNumber: result.companyPhone.phoneNumber,
        label: result.companyPhone.label,
        deviceId: result.companyPhone.deviceId,
      },
      deviceToken: result.deviceToken,
      warning: "Store deviceToken on the Android device. It cannot be recovered later.",
    });
  } catch (error) {
    console.error("Call tracker registration failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Call tracker registration failed.") },
      { status: 500 },
    );
  }
}
