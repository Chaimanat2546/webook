"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  normalizePasswordResetEmail,
  validatePasswordResetEmail,
} from "../../lib/auth/password-reset";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { findSignInEmailByUsername } from "../../server/repositories/admin-users";
import { consumePasswordResetRateLimit } from "../../server/auth/password-reset-rate-limit";

export async function signIn(formData: FormData) {
  const identifierValue = formData.get("identifier") ?? formData.get("email");
  const identifier = String(identifierValue ?? "").trim();
  const password = String(formData.get("adminCredential") ?? formData.get("password") ?? "");

  if (!identifier || !password) {
    redirect("/login?error=invalid");
  }

  const email = await resolveSignInEmail(identifier);

  if (!email) {
    redirect("/login?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid");
  }

  redirect("/admin/houses");
}

async function resolveSignInEmail(identifier: string) {
  if (identifier.includes("@")) {
    return identifier.toLowerCase();
  }

  const supabaseAdmin = createSupabaseAdminClient();

  if (!supabaseAdmin) {
    return null;
  }

  return findSignInEmailByUsername(supabaseAdmin, identifier);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = normalizePasswordResetEmail(formData.get("email"));
  const emailError = validatePasswordResetEmail(email);

  if (emailError) {
    redirect("/login?forgot=1&forgotError=invalid_email");
  }

  if (!consumePasswordResetRateLimit(email)) {
    redirect("/login?forgot=1&forgotError=rate_limited");
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (!origin) {
    redirect("/login?forgot=1&forgotError=send_failed");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/login/reset-password", origin).toString(),
  });

  if (error) {
    redirect("/login?forgot=1&forgotError=send_failed");
  }

  redirect("/login?forgot=1&sent=1");
}
