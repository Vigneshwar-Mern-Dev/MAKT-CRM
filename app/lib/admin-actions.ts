"use server";

import { db } from "./db";
import { hashPassword } from "./password";
import { requireRole } from "./session";
import { revalidatePath } from "next/cache";

interface CreateUserData {
  username: string;
  email: string;
  password?: string;
  role: "ADMIN" | "USER";
  department: string;
}

interface EditUserData {
  id: string;
  username: string;
  email: string;
  password?: string;
  role: "ADMIN" | "USER";
  department: string;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function adminCreateUserAction(data: CreateUserData) {
  try {
    // 1. Ensure caller is an authenticated ADMIN
    await requireRole("ADMIN");

    const username = data.username.trim().toLowerCase();
    const email = data.email.trim().toLowerCase();
    const password = data.password ? data.password.trim() : "";

    if (!username || !email || !password) {
      return { error: "Username, email, and password are all required." };
    }

    if (password.length < 8) {
      return { error: "Password must be at least 8 characters long." };
    }

    // 2. Check for duplicate username/email
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ],
      },
    });

    if (existingUser) {
      return {
        error: "A user with that username or email already exists."
      };
    }

    // 3. Hash password
    const passwordHash = await hashPassword(password);

    // 4. Insert into database
    await db.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: data.role,
        department: data.department,
      },
    });

    // 5. Refresh the user page listing
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error in adminCreateUserAction:", error);
    return {
      error: errorMessage(error, "An unexpected error occurred while creating the user.")
    };
  }
}

export async function adminEditUserAction(data: EditUserData) {
  try {
    // 1. Ensure caller is an authenticated ADMIN
    await requireRole("ADMIN");

    const username = data.username.trim().toLowerCase();
    const email = data.email.trim().toLowerCase();

    if (!username || !email) {
      return { error: "Username and email are required." };
    }

    // 2. Check if username or email is already taken by another account
    const existingUser = await db.user.findFirst({
      where: {
        id: { not: data.id },
        OR: [
          { username },
          { email }
        ],
      },
    });

    if (existingUser) {
      return { error: "Another user with that username or email already exists." };
    }

    const updateData: {
      username: string;
      email: string;
      role: "ADMIN" | "USER";
      department: string;
      passwordHash?: string;
    } = {
      username,
      email,
      role: data.role,
      department: data.department,
    };

    // 3. Hash new password if supplied
    if (data.password && data.password.trim()) {
      if (data.password.trim().length < 8) {
        return { error: "Password must be at least 8 characters long." };
      }
      updateData.passwordHash = await hashPassword(data.password.trim());
    }

    // 4. Update database record
    await db.user.update({
      where: { id: data.id },
      data: updateData,
    });

    // 5. Refresh page listing
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error in adminEditUserAction:", error);
    return { error: errorMessage(error, "An unexpected error occurred while updating the user.") };
  }
}

export async function adminDeleteUserAction(userId: string) {
  try {
    // 1. Ensure caller is an authenticated ADMIN
    const caller = await requireRole("ADMIN");

    const isSelf = caller.id === userId;

    if (isSelf) {
      return { error: "You cannot delete your own admin account while signed in." };
    }

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!target) {
      return { error: "User not found." };
    }

    if (target.role === "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });

      if (adminCount <= 1) {
        return { error: "You cannot delete the last admin account." };
      }
    }

    // 2. Delete user from the database
    await db.user.delete({
      where: { id: userId },
    });

    // 3. Refresh user page listing
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error in adminDeleteUserAction:", error);
    return { error: errorMessage(error, "An unexpected error occurred while deleting the user.") };
  }
}
