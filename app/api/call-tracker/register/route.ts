import { NextRequest, NextResponse } from "next/server";
import {
  registerCompanyPhone,
  validateRegistrationSecret,
} from "@/app/lib/call-tracker";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function apiError(error: string, status: number, retryable: boolean, code: string) {
  return NextResponse.json(
    {
      ok: false,
      code,
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
    let isAuthorized = false;

    try {
      isAuthorized = validateRegistrationSecret(body.registrationSecret);
    } catch (error) {
      console.error("Call tracker registration is not configured:", error);
      return apiError(
        "Call tracker registration is not configured on the server.",
        500,
        false,
        "REGISTRATION_SECRET_NOT_CONFIGURED",
      );
    }

    if (!isAuthorized) {
      return apiError("Unauthorized registration secret.", 401, false, "INVALID_REGISTRATION_SECRET");
    }

    if (typeof body.companyPhone !== "string" || typeof body.deviceId !== "string") {
      return apiError("companyPhone and deviceId are required.", 400, false, "INVALID_REGISTRATION_PAYLOAD");
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
    const message = getErrorMessage(error, "Call tracker registration failed.");
    const isConflict = message.includes("already linked to different company phones");

    return NextResponse.json(
      {
        ok: false,
        code: isConflict ? "DEVICE_PHONE_CONFLICT" : "REGISTRATION_FAILED",
        error: message,
        retryable: !isConflict,
        serverTime: new Date().toISOString(),
      },
      { status: isConflict ? 409 : 500 },
    );
  }
}
