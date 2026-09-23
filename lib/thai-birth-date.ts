export function formatThaiBirthDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${String(Number(match[1]) + 543).padStart(4, "0")}`;
}

export function parseThaiBirthDate(value: string, today: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) throw new Error("กรุณากรอกวันเกิดเป็น วัน/เดือน/ปี พ.ศ. เช่น 23/09/2535");
  const year = Number(match[3]) - 543;
  const iso = `${String(year).padStart(4, "0")}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (year < 1 || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso || iso > today) {
    throw new Error("วันเกิดไม่ถูกต้องหรือเป็นวันในอนาคต กรุณาระบุปี พ.ศ.");
  }
  return iso;
}
