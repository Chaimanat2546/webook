"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import {
  getPasswordResetCooldownSeconds,
  PASSWORD_RESET_COOLDOWN_MS,
  PASSWORD_RESET_RATE_LIMIT_COOLDOWN_MS,
} from "../../lib/auth/password-reset-cooldown";
import { AuthMessage } from "./auth-message";

const cooldownStorageKey = "webook:password-reset-cooldown-until";

function readCooldownUntil() {
  try {
    return Number(window.localStorage.getItem(cooldownStorageKey) ?? 0);
  } catch {
    return 0;
  }
}

function writeCooldownUntil(value: number) {
  try {
    window.localStorage.setItem(cooldownStorageKey, String(value));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

export function PasswordResetRequestForm({
  action,
  forgotError,
  forgotErrorMessage,
  sent,
}: {
  action: (formData: FormData) => Promise<void>;
  forgotError?: string;
  forgotErrorMessage: string | null;
  sent: boolean;
}) {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (forgotError === "invalid_email") {
      writeCooldownUntil(0);
    }

    if (forgotError === "rate_limited") {
      writeCooldownUntil(Date.now() + PASSWORD_RESET_RATE_LIMIT_COOLDOWN_MS);
    }

    function tick() {
      setCooldownSeconds(getPasswordResetCooldownSeconds(readCooldownUntil(), Date.now()));
    }

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [forgotError]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const currentCooldownSeconds = getPasswordResetCooldownSeconds(readCooldownUntil(), Date.now());

    if (currentCooldownSeconds > 0 || isSubmittingRef.current) {
      event.preventDefault();
      setCooldownSeconds(currentCooldownSeconds);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const nextCooldownUntil = Date.now() + PASSWORD_RESET_COOLDOWN_MS;
    writeCooldownUntil(nextCooldownUntil);
    setCooldownSeconds(getPasswordResetCooldownSeconds(nextCooldownUntil, Date.now()));
  }

  const buttonText =
    cooldownSeconds > 0
      ? `ส่งใหม่ได้ใน ${cooldownSeconds} วินาที`
      : isSubmitting
        ? "กำลังส่ง..."
        : "ส่งลิงก์รีเซ็ตรหัสผ่าน";

  return (
    <form action={action} className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {sent ? (
        <AuthMessage tone="success">
          ถ้าอีเมลนี้อยู่ในระบบ เราส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้แล้ว
        </AuthMessage>
      ) : null}

      {forgotErrorMessage ? <AuthMessage tone="error">{forgotErrorMessage}</AuthMessage> : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reset-email">Email</FieldLabel>
          <Input id="reset-email" name="email" type="email" autoComplete="email" required />
        </Field>
      </FieldGroup>

      <Button disabled={cooldownSeconds > 0 || isSubmitting} type="submit">
        {buttonText}
      </Button>
      <Button asChild variant="ghost">
        <Link href="/login">กลับไปเข้าสู่ระบบ</Link>
      </Button>
    </form>
  );
}
