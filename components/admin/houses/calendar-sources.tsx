'use client';

import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Link2, Pencil, RefreshCw } from 'lucide-react';
import { SiAirbnb } from 'react-icons/si';
import type { CalendarSourceSummary } from '@/lib/ical-calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveCalendarSourceAction, refreshCalendarSourcesAction } from '@/app/admin/houses/[propertyId]/calendar-sources/actions';

interface Props {
  propertyId: string;
  initialSources: CalendarSourceSummary[];
}

function time(value: string | null) {
  return value ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : 'ยังไม่เคยอัปเดต';
}

function providerName(provider: CalendarSourceSummary['provider']) {
  return { airbnb: 'Airbnb', booking_com: 'Booking.com', agoda: 'Agoda', other: 'ปฏิทินภายนอก' }[provider];
}

function ProviderIcon({ airbnb, small = false }: { airbnb: boolean; small?: boolean }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-lg ${small ? 'size-6' : 'size-12'} ${airbnb ? 'bg-[#ff385c] text-white' : 'bg-muted text-muted-foreground'}`}>
    {airbnb ? <SiAirbnb aria-hidden className={small ? 'size-4' : 'size-8'} /> : <CalendarDays aria-hidden className={small ? 'size-4' : 'size-6'} />}
  </span>;
}

export function CalendarSources({ propertyId, initialSources }: Props) {
  const [sources, setSources] = useState(initialSources);
  const [selected, setSelected] = useState<CalendarSourceSummary | null>(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingDisconnect, setPendingDisconnect] = useState<CalendarSourceSummary | null>(null);
  const disconnectTrigger = useRef<HTMLElement | null>(null);

  function reset() { setSelected(null); setLabel(''); setUrl(''); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await saveCalendarSourceAction(propertyId, { sourceId: selected?.id, label, url, enabled: selected?.enabled ?? true });
      if (result.ok) { setSources(result.data); reset(); setMessage('บันทึกปฏิทินแล้ว'); }
      else setMessage(result.message);
    } catch { setMessage('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  }

  async function toggle(source: CalendarSourceSummary) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await saveCalendarSourceAction(propertyId, { sourceId: source.id, label: source.label, url: '', enabled: !source.enabled });
      if (result.ok) { setSources(result.data); reset(); setPendingDisconnect(null); setMessage(source.enabled ? 'หยุดเชื่อมต่อปฏิทินแล้ว' : 'เปิดการเชื่อมต่อปฏิทินแล้ว'); }
      else setMessage(result.message);
    } catch { setMessage('เปลี่ยนสถานะไม่สำเร็จ'); }
    finally { setBusy(false); }
  }

  async function refresh() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await refreshCalendarSourcesAction(propertyId);
      if (result.ok) { setSources(result.data); setMessage('ตรวจสอบข้อมูลปฏิทินแล้ว หากเพิ่งอัปเดต ระบบอาจใช้ข้อมูลเดิมภายใน 5 นาที'); }
      else setMessage(result.message);
    } catch { setMessage('อัปเดตข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  }

  return <div className="@container space-y-6" aria-busy={busy}>
    <section aria-labelledby="connected-calendars" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="connected-calendars" className="text-sm font-semibold text-primary">แหล่งที่เชื่อมต่อแล้ว</h3>
        <Button type="button" variant="outline" className="h-11" disabled={busy || sources.length === 0} onClick={() => void refresh()}><RefreshCw aria-hidden />อัปเดตทั้งหมด</Button>
      </div>
      {sources.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">ยังไม่มีปฏิทินที่เชื่อมต่อ เพิ่มลิงก์ Airbnb ด้านล่างเพื่อเริ่มใช้งาน</p>}
      {sources.map(source => <article key={source.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3 @lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderIcon airbnb={source.provider === 'airbnb'} />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold">{providerName(source.provider)}</h4>
            <p className="break-words text-xs text-muted-foreground">{source.label}</p>
          </div>
        </div>
        <div className="col-span-2 row-start-2 min-w-0 space-y-1 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1 @lg:border-l @lg:pl-4">
          <p className={`flex items-center gap-2 text-xs ${source.enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${source.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
            {source.enabled ? 'ใช้งานอยู่' : 'หยุดเชื่อมต่อ'}
          </p>
          <p className="text-xs text-muted-foreground">{source.last_synced_at ? `อัปเดตล่าสุด ${time(source.last_synced_at)}` : time(null)}</p>
          {source.last_error_code && <p role="alert" className="text-xs text-destructive">อัปเดตไม่สำเร็จ ข้อมูลอาจไม่ล่าสุด กรุณาลองอีกครั้ง</p>}
        </div>
        <div className="col-start-2 row-start-1 flex items-center gap-3 @lg:col-start-3">
          <Switch aria-label={`เปิดหรือปิดปฏิทิน ${source.label}`} checked={source.enabled} disabled={busy} onCheckedChange={() => {
            if (source.enabled) {
              disconnectTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              setMessage(''); setPendingDisconnect(source);
            } else void toggle(source);
          }} className="data-[size=default]:h-6 data-[size=default]:w-10 [&_[data-slot=switch-thumb]]:size-5" />
          <Button type="button" variant="outline" className="h-10" disabled={busy} aria-label={`แก้ไขปฏิทิน ${source.label}`} onClick={() => { setSelected(source); setLabel(source.label); setUrl(''); }}><Pencil aria-hidden />แก้ไข</Button>
        </div>
      </article>)}
    </section>

    <section className="space-y-4 border-t pt-5" aria-labelledby="calendar-form-title">
      <h3 id="calendar-form-title" className="text-sm font-semibold">{selected ? 'แก้ไขปฏิทิน' : 'เพิ่มแหล่งปฏิทิน'}</h3>
      <form onSubmit={save} className="space-y-3">
        <div className="grid min-w-0 items-end gap-3 @sm:grid-cols-2 @2xl:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="calendar-provider">แพลตฟอร์ม</Label>
            <Select value={selected?.provider ?? 'airbnb'} disabled={busy || !!selected}>
              <SelectTrigger id="calendar-provider" aria-label="แพลตฟอร์มปฏิทิน" className="data-[size=default]:h-11 w-full"><SelectValue><span className="flex items-center gap-2"><ProviderIcon airbnb={!selected || selected.provider === 'airbnb'} small />{selected ? providerName(selected.provider) : 'Airbnb'}</span></SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="airbnb"><ProviderIcon airbnb small />Airbnb</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-2"><Label htmlFor="calendar-label">ชื่อปฏิทิน</Label><Input id="calendar-label" name="calendar-label" autoComplete="off" className="h-11" placeholder="เช่น Airbnb บัญชีหลัก" value={label} maxLength={120} required disabled={busy} onChange={e => setLabel(e.target.value)} /></div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="calendar-url">ลิงก์ปฏิทิน Airbnb</Label>
            <div className="relative">
              <Link2 aria-hidden className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
              <Input id="calendar-url" name="calendar-feed-url" type="password" autoComplete="new-password" placeholder="วาง iCal URL ที่นี่" className="h-11 pl-10" value={url} maxLength={4096} required={!selected} disabled={busy} onChange={e => setUrl(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="h-11 px-5" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : selected ? 'บันทึก' : 'เชื่อมต่อ'}</Button>
        </div>
        {selected && <p className="text-xs text-muted-foreground">เว้นว่างเพื่อใช้ลิงก์เดิม หากเปลี่ยนลิงก์ วันที่จากปฏิทินเดิมจะถูกนำออกจนกว่าอัปเดตข้อมูลใหม่สำเร็จ</p>}
        {selected && <Button type="button" variant="ghost" disabled={busy} onClick={reset}>ยกเลิก</Button>}
      </form>
    </section>
    {message && <p role="status" className="text-sm">{message}</p>}
    <Dialog open={pendingDisconnect !== null} onOpenChange={open => { if (!open && !busy) setPendingDisconnect(null); }}>
      <DialogContent showCloseButton={!busy} onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
        onCloseAutoFocus={event => { event.preventDefault(); disconnectTrigger.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>หยุดเชื่อมปฏิทิน</DialogTitle>
          <DialogDescription>วันที่ไม่ว่างจากปฏิทินนี้จะถูกนำออกจากตารางการจอง</DialogDescription>
        </DialogHeader>
        <p className="break-words text-sm font-medium">{pendingDisconnect?.label}</p>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setPendingDisconnect(null)}>ยกเลิก</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => { if (pendingDisconnect) void toggle(pendingDisconnect); }}>{busy ? 'กำลังดำเนินการ…' : 'หยุดเชื่อมต่อ'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
