"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  normalizePasswordResetEmail,
  validatePasswordResetEmail,
} from "../../lib/auth/password-reset";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { findSignInEmailByUsername } from "../../server/repositories/admin-users";
import { consumePasswordResetRateLimit } from "../../server/auth/password-reset-rate-limit";
import type { LoginFormState } from "../../lib/auth/login-form-state";

export async function signIn(formData: FormData): Promise<LoginFormState> {
  const identifierValue = formData.get("identifier") ?? formData.get("email");
  const identifier = String(identifierValue ?? "").trim();
  const password = String(formData.get("adminCredential") ?? formData.get("password") ?? "");

  if (!identifier || !password) {
    return { status: "invalid", identifier, field: !identifier ? "identifier" : "adminCredential" };
  }

  const attempt = await (async () => {
    try {
      const email = await resolveSignInEmail(identifier);
      if (!email) return { invalid: true as const };
      const supabase = await createSupabaseServerClient();
      const cookieStore = await cookies();
      const previousBinding = cookieStore.get("webook_push_subscription")?.value;
      const previousActor = previousBinding ? (await supabase.auth.getUser()).data.user?.id ?? null : null;
      const result = await supabase.auth.signInWithPassword({ email, password });
      return { cookieStore, previousBinding, previousActor, result };
    } catch { return null; }
  })();
  if (!attempt) return { status: "request_error", identifier };
  if ("invalid" in attempt) return { status: "invalid", identifier, field: "adminCredential" };
  const { cookieStore, previousBinding, previousActor, result: { data, error } } = attempt;

  if (error) {
    return { status: error.code === "invalid_credentials" ? "invalid" : "request_error", identifier, field: "adminCredential" };
  }

  if (previousBinding && previousActor && data.user && previousActor !== data.user.id) {
    try {
      const client = createSupabaseAdminClient();
      if (client) {
        const { createNotificationRepository } = await import("../../server/repositories/booking-notifications");
        const { retirePushBindingOnAccountChange } = await import("../../server/services/booking-notifications");
        await retirePushBindingOnAccountChange(createNotificationRepository(client), previousActor, data.user.id, previousBinding);
      }
    } catch {
      // The root Push session guard also retires the browser subscription.
    }
    cookieStore.delete("webook_push_subscription");
  }

  if (data.user && data.session) {
    const { recordSignedInSession, createSignInAuditVerifier } = await import("../../server/auth/login-history");
    const history = await recordSignedInSession(createSignInAuditVerifier, data.session.access_token, data.user.id, await headers());
    if (history) redirect(`/login/location?history=${encodeURIComponent(history.id)}`);
  }
  redirect("/");
}

export async function signInAction(_previous: LoginFormState, formData: FormData): Promise<LoginFormState> {
  return signIn(formData);
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
  const cookieStore = await cookies();
  const subscriptionId = cookieStore.get("webook_push_subscription")?.value;
  if (subscriptionId) {
    try {
      const { notificationSession } = await import("../../server/auth/notifications");
      const { notificationId } = await import("../../lib/booking-notifications");
      const { actorId, repository } = await notificationSession(false);
      await repository.unsubscribe(actorId, { subscriptionId: notificationId(subscriptionId) });
    } catch {
      // Browser sign-out also unsubscribes the local Push subscription. Signing
      // out must remain available when the database or migration is unavailable.
    }
    cookieStore.delete("webook_push_subscription");
  }
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
