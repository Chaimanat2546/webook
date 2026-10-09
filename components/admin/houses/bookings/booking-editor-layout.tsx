import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';

interface Props {
  presentation: 'sheet' | 'dialog';
  dates: ReactNode;
  children: ReactNode;
}

export function BookingEditorLayout({presentation,dates,children}:Props) {
  return <div className={presentation==='dialog'?'grid gap-5 lg:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.2fr)]':'space-y-5'}>
    <section className="min-w-0 space-y-3"><h3 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground"/>ช่วงเข้าพัก</h3>{dates}</section>
    <div className="min-w-0 space-y-5">{children}</div>
  </div>;
}
