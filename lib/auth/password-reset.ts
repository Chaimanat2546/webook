const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SYMBOL_PATTERN = /[^A-Za-z0-9\s]/;

export const passwordResetMessages = {
  emailRequired: "กรุณากรอกอีเมล",
  emailInvalid: "กรุณากรอกอีเมลให้ถูกต้อง",
  passwordRequired: "กรุณากรอกรหัสผ่านใหม่",
  confirmRequired: "กรุณายืนยันรหัสผ่านใหม่",
  passwordTooShort: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  passwordTooLong: "รหัสผ่านต้องไม่เกิน 128 ตัวอักษร",
  passwordNeedsLowercase: "รหัสผ่านต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว",
  passwordNeedsUppercase: "รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว",
  passwordNeedsNumber: "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว",
  passwordNeedsSymbol: "รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว",
  passwordMismatch: "รหัสผ่านทั้งสองช่องต้องตรงกัน",
} as const;

export function normalizePasswordResetEmail(value: FormDataEntryValue | string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export function validatePasswordResetEmail(email: string): string | null {
  if (!email) {
    return passwordResetMessages.emailRequired;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return passwordResetMessages.emailInvalid;
  }

  return null;
}

export function validateNewPassword({
  confirmPassword,
  password,
}: {
  confirmPassword: string;
  password: string;
}): string[] {
  const errors: string[] = [];

  if (!password) {
    errors.push(passwordResetMessages.passwordRequired);
  }

  if (!confirmPassword) {
    errors.push(passwordResetMessages.confirmRequired);
  }

  if (password && password.length < 8) {
    errors.push(passwordResetMessages.passwordTooShort);
  }

  if (password.length > 128) {
    errors.push(passwordResetMessages.passwordTooLong);
  }

  if (password && !/[a-z]/.test(password)) {
    errors.push(passwordResetMessages.passwordNeedsLowercase);
  }

  if (password && !/[A-Z]/.test(password)) {
    errors.push(passwordResetMessages.passwordNeedsUppercase);
  }

  if (password && !/\d/.test(password)) {
    errors.push(passwordResetMessages.passwordNeedsNumber);
  }

  if (password && !SYMBOL_PATTERN.test(password)) {
    errors.push(passwordResetMessages.passwordNeedsSymbol);
  }

  if (password && confirmPassword && password !== confirmPassword) {
    errors.push(passwordResetMessages.passwordMismatch);
  }

  return errors;
}
