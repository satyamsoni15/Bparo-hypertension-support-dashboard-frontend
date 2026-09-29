"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { supportFetch, SupportApiError } from "@/lib/api";
import type { LoginResponse } from "@/lib/types";

export type LoginState = { error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function loginAction(input: { email: string; password: string }): Promise<LoginState> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || !input.password) return { error: "Enter your email and password." };

  let login: LoginResponse;
  try {
    login = await supportFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password: input.password },
    });
  } catch (err) {
    if (err instanceof SupportApiError) {
      if (err.status === 401) return { error: "Incorrect email or password, or the account is inactive." };
      return { error: err.message };
    }
    return { error: "Unable to reach the support server." };
  }
  if (!login?.accessToken) return { error: "Sign-in failed. Please try again." };

  try {
    await signIn("credentials", { accessToken: login.accessToken, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return { error: "Your account can't use the support dashboard." };
    throw err;
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
