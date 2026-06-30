import Link from "next/link";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { requestPasswordReset, signIn } from "./actions";
import { AuthMessage } from "./auth-message";
import { PasswordResetRequestForm } from "./password-reset-request-form";

function getForgotErrorMessage(error?: string) {
  if (error === "invalid_email") {
    return "กรุณากรอกอีเมลให้ถูกต้อง";
  }

  if (error === "rate_limited") {
    return "ส่งคำขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณารอ 1 นาทีแล้วลองใหม่";
  }

  if (error === "send_failed") {
    return "ยังส่งอีเมลรีเซ็ตรหัสผ่านไม่ได้ กรุณาลองใหม่อีกครั้ง";
  }

  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    forgot?: string;
    forgotError?: string;
    sent?: string;
  }>;
}) {
  const { error, forgot, forgotError, sent } = await searchParams;
  const isForgotMode = forgot === "1" || sent === "1" || Boolean(forgotError);
  const forgotErrorMessage = getForgotErrorMessage(forgotError);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">Webook</p>
          <CardTitle>{isForgotMode ? "รีเซ็ตรหัสผ่านผู้ดูแล" : "เข้าสู่ระบบผู้ดูแล"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isForgotMode ? (
            <PasswordResetRequestForm
              action={requestPasswordReset}
              forgotError={forgotError}
              forgotErrorMessage={forgotErrorMessage}
              sent={sent === "1"}
            />
          ) : (
            <form action={signIn} className="flex flex-col gap-4">
              {error ? (
                <AuthMessage tone="error">อีเมลหรือรหัสผ่านไม่ถูกต้อง</AuthMessage>
              ) : null}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
              </FieldGroup>

              <Button type="submit">เข้าสู่ระบบ</Button>
              <Button asChild variant="ghost">
                <Link href="/login?forgot=1">ลืมรหัสผ่าน</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
