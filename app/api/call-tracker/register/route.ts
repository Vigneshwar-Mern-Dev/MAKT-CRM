import { NextRequest, NextResponse } from "next/server";
import {
  registerCompanyPhone,
  validateRegistrationSecret,
} from "@/app/lib/call-tracker";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function apiError(error: string, status: number, retryable: boolean) {
  return NextResponse.json(
    {
      ok: false,
      error,
      retryable,
      serverTime: new Date().toISOString(),
    },
    { status },
  );
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
      return apiError("Unauthorized registration secret.", 401, false);
    }

    if (typeof body.companyPhone !== "string" || typeof body.deviceId !== "string") {
      return apiError("companyPhone and deviceId are required.", 400, false);
    }

    const result = await registerCompanyPhone({
      companyPhone: body.companyPhone,
      deviceId: body.deviceId,
      label: typeof body.label === "string" ? body.label : undefined,
    });

    return NextResponse.json({
      ok: true,
      retryable: false,
      serverTime: new Date().toISOString(),
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
      {
        ok: false,
        error: getErrorMessage(error, "Call tracker registration failed."),
        retryable: true,
        serverTime: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
