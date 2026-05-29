"use server";

import { redirect } from "next/navigation";
import { db } from "./db";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const maxLoginAttempts = 5;
const loginLockMs = 1000 * 60 * 10;

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function hasPrismaCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function handleDatabaseError(path: string, error: unknown): never {
  if (hasPrismaCode(error, "P1001")) {
    redirectWithError(
      path,
      "Database connection failed. Check your internet connection or Neon database status, then try again.",
    );
  }

  throw error;
}

function assertLoginAllowed(identifier: string) {
  const attempt = loginAttempts.get(identifier);

  if (attempt && attempt.lockedUntil > Date.now()) {
    redirectWithError(
      "/login",
      "Too many failed login attempts. Wait 10 minutes, then try again.",
    );
  }
}

function recordFailedLogin(identifier: string) {
  const current = loginAttempts.get(identifier);
  const count = (current?.count ?? 0) + 1;

  loginAttempts.set(identifier, {
    count,
    lockedUntil: count >= maxLoginAttempts ? Date.now() + loginLockMs : 0,
  });
}

function clearFailedLogins(identifier: string) {
  loginAttempts.delete(identifier);
}

export async function loginAction(formData: FormData) {
  const identifier = formValue(formData, "identifier").toLowerCase();
  const password = formValue(formData, "password");

  if (!identifier || !password) {
    redirectWithError("/login", "Enter your username or email and password.");
  }

  assertLoginAllowed(identifier);

  let user;

  try {
    user = await db.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
  } catch (error) {
    handleDatabaseError("/login", error);
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordFailedLogin(identifier);
    redirectWithError(
      "/login",
      "We could not sign you in. Check your details or contact your CRM administrator.",
    );
  }

  clearFailedLogins(identifier);
  await createSession(user);
  redirect(user.role === "ADMIN" ? "/admin" : "/user");
}

export async function registerAction() {
  redirectWithError("/login", "Public registration is disabled on this platform.");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
