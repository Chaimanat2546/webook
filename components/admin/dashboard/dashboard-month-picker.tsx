"use client";

import { useRouter } from "next/navigation";

import { ThaiMonthPicker } from "../../ui/thai-month-picker";

interface DashboardMonthPickerProps {
  action: string;
  month: string;
}

export function DashboardMonthPicker({ action, month }: DashboardMonthPickerProps) {
  const router = useRouter();

  function navigate(selectedMonth: string) {
    router.push(`${action}?month=${selectedMonth}`);
  }

  return <ThaiMonthPicker month={month} onMonthChange={navigate} />;
}
