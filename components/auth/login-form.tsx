"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { signInAction } from "../../app/login/actions";
import { INITIAL_LOGIN_STATE } from "../../lib/auth/login-form-state";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface LoginFormProps { initialError?: boolean; expired?: boolean }

export function LoginForm({ initialError = false, expired = false }: LoginFormProps) {
  const [state, action, pending] = useActionState(signInAction, initialError ? { ...INITIAL_LOGIN_STATE, status: "invalid" as const } : INITIAL_LOGIN_STATE);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const invalid = state.status === "invalid";
  const message = invalid ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : state.status === "request_error" ? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" : "";
  useEffect(() => {
    if (state.status === "idle") return;
    form.current?.querySelector<HTMLInputElement>(`[name="${state.field ?? "identifier"}"]`)?.focus();
  }, [state]);

  return <div className="space-y-3.5"><form ref={form} action={action} className="flex flex-col gap-3" onInvalid={event => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target === form.current?.querySelector(":invalid")) target.focus();
  }}>
    {expired && !message ? <p role="status" className="text-sm text-muted-foreground">เซสชันหมดอายุ โปรดเข้าสู่ระบบอีกครั้ง</p> : null}
    <div className="space-y-1.5">
      <Label htmlFor="identifier" className="text-sm leading-5 font-normal">Email หรือ Username</Label>
      <Input id="identifier" name="identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={pending} aria-invalid={invalid} aria-describedby={message ? "login-error" : undefined} className="h-10 rounded-lg" />
    </div>
    <div className="space-y-1.5 pb-1.5">
      <Label htmlFor="admin-credential" className="text-sm leading-5 font-normal">Password</Label>
      <div className="relative">
        <Input id="admin-credential" name="adminCredential" value={password} onChange={event => setPassword(event.target.value)} type={visible ? "text" : "password"} autoComplete="current-password" required disabled={pending} aria-invalid={invalid} aria-describedby={message ? "login-error" : undefined} className="h-10 rounded-lg pr-11" />
        <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 size-10 text-muted-foreground" disabled={pending} aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff aria-hidden className="size-[18px]" /> : <Eye aria-hidden className="size-[18px]" />}</Button>
      </div>
    </div>
    {message ? <p id="login-error" role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive"><AlertCircle aria-hidden className="size-4 shrink-0" />{message}</p> : null}
    <span role="status" aria-live="polite" className="sr-only">{pending ? "กำลังเข้าสู่ระบบ" : ""}</span>
    <Button type="submit" disabled={pending} aria-busy={pending} className="h-10 w-full rounded-lg text-base font-medium">{pending ? <><LoaderCircle aria-hidden className="size-4 animate-spin" />กำลังเข้าสู่ระบบ</> : "เข้าสู่ระบบ"}</Button>
  </form><Button asChild variant="link" className="h-[21px] w-full py-0 text-sm"><Link href="/login?forgot=1">ลืมรหัสผ่าน</Link></Button></div>;
}
