"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Field, FieldGroup, FieldLabel } from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import { validateNewPassword } from "../../../lib/auth/password-reset";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { AuthMessage } from "../auth-message";

const invalidLinkMessage =
  "ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่อีกครั้ง";

function getPasswordUpdateErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("jwt") ||
    normalized.includes("session")
  ) {
    return invalidLinkMessage;
  }

  if (normalized.includes("password") || normalized.includes("weak")) {
    return "รหัสผ่านยังไม่ผ่านเงื่อนไขความปลอดภัย กรุณาตรวจสอบแล้วลองใหม่";
  }

  return "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง";
}

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [pageState, setPageState] = useState<"checking" | "invalid" | "ready" | "saved">(
    "checking",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const invalidTimer = window.setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active) {
        setPageState(session ? "ready" : "invalid");
      }
    }, 1200);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || session) {
        window.clearTimeout(invalidTimer);
        setPageState("ready");
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session) {
        window.clearTimeout(invalidTimer);
        setPageState("ready");
      }
    });

    return () => {
      active = false;
      window.clearTimeout(invalidTimer);
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);

    const validationErrors = validateNewPassword({ confirmPassword, password });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (pageState !== "ready") {
      setErrors([invalidLinkMessage]);
      setPageState("invalid");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrors([getPasswordUpdateErrorMessage(error.message)]);
      setIsSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    setPassword("");
    setConfirmPassword("");
    setPageState("saved");
    setIsSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">Webook</p>
          <CardTitle>ตั้งรหัสผ่านใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          {pageState === "checking" ? (
            <AuthMessage tone="info">กำลังตรวจสอบลิงก์รีเซ็ตรหัสผ่าน</AuthMessage>
          ) : null}

          {pageState === "invalid" ? (
            <div className="flex flex-col gap-4">
              <AuthMessage tone="error">{invalidLinkMessage}</AuthMessage>
              <Button asChild>
                <Link href="/login?forgot=1">ขอลิงก์ใหม่</Link>
              </Button>
            </div>
          ) : null}

          {pageState === "saved" ? (
            <div className="flex flex-col gap-4">
              <AuthMessage tone="success">
                เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่
              </AuthMessage>
              <Button asChild>
                <Link href="/login">เข้าสู่ระบบ</Link>
              </Button>
            </div>
          ) : null}

          {pageState === "ready" ? (
            <form autoComplete="off" className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {errors.length > 0 ? (
                <AuthMessage tone="error">
                  <ul className="list-disc space-y-1 pl-4">
                    {errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </AuthMessage>
              ) : null}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-password">รหัสผ่านใหม่</FieldLabel>
                  <Input
                    id="new-password"
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    data-lpignore="true"
                    minLength={8}
                    name="newAdminCredential"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</FieldLabel>
                  <Input
                    id="confirm-password"
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    data-lpignore="true"
                    minLength={8}
                    name="confirmAdminCredential"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </Field>
              </FieldGroup>

              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
