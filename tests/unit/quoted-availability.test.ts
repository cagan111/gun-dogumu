import { expect, it } from 'vitest';
import { computeQuotedAvailability } from '@/lib/quoted-availability';
const service={id:'svc',tenantId:'tenant',durationMin:30,bufferMin:10,priceTry:'100.50'};
const tenant={timeZone:'UTC',slotMinutes:15,minLeadMinutes:0,maxAdvanceDays:30};
const person=(id:string,duration:number|null=null,price:string|null=null)=>({staff:{id,tenantId:'tenant'},link:{tenantId:'tenant',serviceId:'svc',staffId:id,durationMinOverride:duration,priceTryOverride:price},availability:{id,workingHours:[{weekday:1,startMin:540,endMin:660,breaks:[] as [number,number][]}],timeOff:[]}});
const input=()=>({tenant,service,people:[person('a'),person('b',60,'0')],busy:[],date:'2026-11-23',now:new Date('2026-11-22T00:00:00Z')});
it('uses each staff duration/buffer and exposes exact independent price offers',()=>{
 const q=input(),before=JSON.stringify(q),slots=computeQuotedAvailability(q);
 const first=slots.find(s=>s.start.toISOString()==='2026-11-23T09:00:00.000Z')!;
 expect(first.offers).toEqual([{serviceId:'svc',staffId:'a',startsAt:'2026-11-23T09:00:00.000Z',durationMin:30,bufferMin:10,priceTry:'100.50'},{serviceId:'svc',staffId:'b',startsAt:'2026-11-23T09:00:00.000Z',durationMin:60,bufferMin:10,priceTry:'0.00'}]);
 expect(slots.find(s=>s.start.toISOString()==='2026-11-23T10:00:00.000Z')!.staffIds).toEqual(['a']);
 expect(JSON.stringify(q)).toBe(before);
});
it('busy staff and duration-overlapping breaks cannot borrow another person availability',()=>{
 const q=input();q.people[0]!.availability.workingHours[0]!.breaks=[[585,600]];
 const slots=computeQuotedAvailability({...q,busy:[{staffId:'b',startsAt:new Date('2026-11-23T09:00Z'),blockedUntil:new Date('2026-11-23T10:00Z')}]});
 expect(slots.find(s=>s.start.toISOString()==='2026-11-23T09:15:00.000Z')).toBeUndefined();
 expect(slots.find(s=>s.start.toISOString()==='2026-11-23T10:00:00.000Z')!.staffIds).toEqual(['a']);
});
it('rejects foreign eligibility, duplicate staff and mismatched availability ids',()=>{
 const q=input();expect(()=>computeQuotedAvailability({...q,people:[{...q.people[0]!,link:{...q.people[0]!.link,tenantId:'foreign'}}]})).toThrow();
 expect(()=>computeQuotedAvailability({...q,people:[q.people[0]!,q.people[0]!]})).toThrow();
 expect(()=>computeQuotedAvailability({...q,people:[{...q.people[0]!,availability:{...q.people[0]!.availability,id:'b'}}]})).toThrow();
});
it('keeps UTC ordering and valid local slots through a spring DST gap',()=>{
 const q=input();const people=q.people.map(p=>({...p,availability:{...p.availability,workingHours:[{weekday:0,startMin:120,endMin:300,breaks:[] as [number,number][]}]}}));
 const slots=computeQuotedAvailability({...q,tenant:{...tenant,timeZone:'Europe/Nicosia'},people,date:'2027-03-28',now:new Date('2027-03-27T00:00Z')});
 expect(slots.length).toBeGreaterThan(0);
 const times=slots.map(s=>+s.start);expect(times).toEqual([...new Set(times)].sort((a,b)=>a-b));
 for(const slot of slots){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Nicosia',hour:'2-digit',hourCycle:'h23'}).format(slot.start));expect(hour).not.toBe(3);expect(slot.offers.map(o=>o.staffId)).toEqual(slot.staffIds);}
});
it('carries staff-specific duration through an overnight shift on the next local day',()=>{
 const q=input();const people=q.people.map(p=>({...p,availability:{...p.availability,workingHours:[{weekday:1,startMin:1380,endMin:1560,breaks:[] as [number,number][]}]}}));
 const slots=computeQuotedAvailability({...q,people,date:'2026-11-24'});
 expect(slots[0]!.start.toISOString()).toBe('2026-11-24T00:00:00.000Z');
 expect(slots[0]!.staffIds).toEqual(['a','b']);
 expect(slots.find(s=>s.start.toISOString()==='2026-11-24T01:00:00.000Z')!.staffIds).toEqual(['a']);
 expect(slots.every(s=>s.start.toISOString().startsWith('2026-11-24'))).toBe(true);
});
