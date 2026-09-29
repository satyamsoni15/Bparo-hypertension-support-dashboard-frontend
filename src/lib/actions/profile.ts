"use server";

import { invalid, withSession } from "@/lib/session";
import type { Result } from "@/lib/types";

export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<Result<null>> {
  if (!input.currentPassword) return invalid("Enter your current password.");
  if (input.newPassword.length < 8) return invalid("The new password must be at least 8 characters.");
  if (input.newPassword.length > 128) return invalid("The new password is too long.");
  if (input.newPassword === input.currentPassword) return invalid("The new password must be different.");
  return withSession(async (call) => {
    await call("/auth/change-password", {
      method: "POST",
      body: { currentPassword: input.currentPassword, newPassword: input.newPassword },
    });
    return null;
  });
}
