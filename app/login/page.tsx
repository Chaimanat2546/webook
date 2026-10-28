import { LoginForm } from "../../components/auth/login-form";
import Image from "next/image";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { requestPasswordReset } from "./actions";
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
    expired?: string;
    forgot?: string;
    forgotError?: string;
    sent?: string;
  }>;
}) {
  const { error, expired, forgot, forgotError, sent } = await searchParams;
  const isForgotMode = forgot === "1" || sent === "1" || Boolean(forgotError);
  const forgotErrorMessage = getForgotErrorMessage(forgotError);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 py-10">
      <Card className="w-full max-w-[320px] gap-3.5 rounded-xl p-[18px] shadow-sm ring-border ring-inset">
        <CardHeader className="gap-3.5 p-0">
          <Image
            src="/brand/webooks-logo-transparent.png"
            alt="WeBooks ระบบจัดการบ้านพัก"
            width={500}
            height={500}
            className="mx-auto h-[140px] w-full object-contain"
            priority
          />
          <CardTitle className="text-base leading-snug font-medium">{isForgotMode ? "รีเซ็ตรหัสผ่านผู้ดูแล" : "เข้าสู่ระบบผู้ดูแล"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isForgotMode ? (
            <PasswordResetRequestForm
              action={requestPasswordReset}
              forgotError={forgotError}
              forgotErrorMessage={forgotErrorMessage}
              sent={sent === "1"}
            />
          ) : (
            <LoginForm initialError={Boolean(error)} expired={expired === "1"} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
