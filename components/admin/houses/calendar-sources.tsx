'use client';
import { useState, type FormEvent } from 'react';
import type { CalendarSourceSummary } from '@/lib/ical-calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveCalendarSourceAction, refreshCalendarSourcesAction } from '@/app/admin/houses/[propertyId]/calendar-sources/actions';

function time(value:string|null){return value?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(value)):'ยังไม่เคยอัปเดต';}
export function CalendarSources({propertyId,initialSources}:{propertyId:string;initialSources:CalendarSourceSummary[]}){
  const [sources,setSources]=useState(initialSources),[selected,setSelected]=useState<CalendarSourceSummary|null>(null);
  const [label,setLabel]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  function reset(){setSelected(null);setLabel('');setUrl('');}
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;setBusy(true);setMessage('');
    try{const result=await saveCalendarSourceAction(propertyId,{sourceId:selected?.id,label,url,enabled:selected?.enabled??true});
      if(result.ok){setSources(result.data);reset();setMessage('บันทึกปฏิทินแล้ว');}else setMessage(result.message);
    }catch{setMessage('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');}finally{setBusy(false);}
  }
  async function toggle(source:CalendarSourceSummary){
    if(busy)return;
    if(source.enabled&&!window.confirm('หยุดเชื่อมปฏิทินนี้? วันที่ไม่ว่างจากปฏิทินนี้จะถูกนำออกจากตารางการจอง'))return;
    setBusy(true);setMessage('');
    try{const result=await saveCalendarSourceAction(propertyId,{sourceId:source.id,label:source.label,url:'',enabled:!source.enabled});
      if(result.ok){setSources(result.data);reset();}else setMessage(result.message);
    }catch{setMessage('เปลี่ยนสถานะไม่สำเร็จ');}finally{setBusy(false);}
  }
  async function refresh(){if(busy)return;setBusy(true);setMessage('');try{const result=await refreshCalendarSourcesAction(propertyId);
    if(result.ok){setSources(result.data);setMessage('ตรวจสอบข้อมูลปฏิทินแล้ว หากเพิ่งอัปเดต ระบบอาจใช้ข้อมูลเดิมภายใน 5 นาที');}else setMessage(result.message);
  }catch{setMessage('อัปเดตข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');}finally{setBusy(false);}}
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">นำวันไม่ว่างจาก Airbnb มาแสดงในตารางการจอง ข้อมูลอาจล่าช้าตามการอัปเดตของต้นทาง</p>
    <Button type="button" variant="outline" disabled={busy} onClick={()=>void refresh()}>อัปเดตข้อมูล</Button>
    {message&&<p role="status" className="text-sm">{message}</p>}
    <div className="space-y-3">{sources.map(source=><article key={source.id} className="space-y-2 rounded-lg border p-3">
      <h3 className="font-medium">{source.label} · {source.provider==='airbnb'?'Airbnb':'ปฏิทินภายนอก'}</h3>
      <p className="text-sm text-muted-foreground">{source.enabled?'เชื่อมต่ออยู่':'หยุดเชื่อมต่อ'} · อัปเดตสำเร็จล่าสุด: {time(source.last_synced_at)}</p>
      {source.last_error_code&&<p role="alert" className="text-sm text-destructive">อัปเดตไม่สำเร็จ ข้อมูลอาจไม่ล่าสุด กรุณาลองอีกครั้ง</p>}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>{setSelected(source);setLabel(source.label);setUrl('');}}>แก้ไข</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={()=>void toggle(source)}>{source.enabled?'หยุดเชื่อมต่อ':'เปิดการเชื่อมต่อ'}</Button></div>
    </article>)}</div>
    <form onSubmit={save} className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">{selected?'แก้ไขปฏิทิน':'เพิ่มปฏิทิน Airbnb'}</h3>
      <Label htmlFor="calendar-label">ชื่อปฏิทิน</Label><Input id="calendar-label" name="calendar-label" autoComplete="off" placeholder="เช่น Airbnb บ้านทะเล" value={label} maxLength={120} required disabled={busy} onChange={e=>setLabel(e.target.value)} />
      <Label htmlFor="calendar-url">ลิงก์ปฏิทิน Airbnb</Label><Input id="calendar-url" name="calendar-feed-url" type="password" autoComplete="new-password" value={url} maxLength={4096} required={!selected} disabled={busy} onChange={e=>setUrl(e.target.value)} />
      <p className="text-xs text-muted-foreground">{selected?'เว้นว่างเพื่อใช้ลิงก์เดิม หากเปลี่ยนลิงก์ วันที่จากปฏิทินเดิมจะถูกนำออกจนกว่าอัปเดตข้อมูลใหม่สำเร็จ':'ใช้ลิงก์จากเมนูส่งออกปฏิทินของ Airbnb (Export calendar)'}</p>
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy?'กำลังดำเนินการ…':'บันทึก'}</Button>{selected&&<Button type="button" variant="ghost" disabled={busy} onClick={reset}>ยกเลิก</Button>}</div>
    </form>
  </div>;
}
