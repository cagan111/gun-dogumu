import { afterAll, expect, it } from "vitest";
try { process.loadEnvFile('.env'); } catch { /* local */ }
import { prisma } from "@/lib/db";
import { resolveTenantUser } from "@/lib/session";
import { moveAppointment } from "@/lib/panel/appointments";
import { MemoryQueue, setQueue } from "@/jobs/queue";
const ids: string[] = [];
const dbit = it.skipIf(!process.env.DATABASE_URL);
async function fixture() {
 const t=await prisma.tenant.create({data:{slug:`move-terms-${crypto.randomUUID()}`,name:'Fixture',city:'Girne',status:'active',timeZone:'UTC'}});ids.push(t.id);
 const owner=await prisma.user.create({data:{tenantId:t.id,email:`${crypto.randomUUID()}@example.test`,name:'Owner',role:'owner'}});
 const service=await prisma.service.create({data:{tenantId:t.id,nameTr:'Fixture',durationMin:30,bufferMin:10,priceTry:'125.50'}});
 const staff=await Promise.all([0,1].map(sortOrder=>prisma.staff.create({data:{tenantId:t.id,name:'Fixture',sortOrder}})));
 for(const s of staff){await prisma.serviceStaff.create({data:{tenantId:t.id,serviceId:service.id,staffId:s.id}});await prisma.workingHours.createMany({data:[0,1,2,3,4,5,6].map(weekday=>({tenantId:t.id,staffId:s.id,weekday,startMin:540,endMin:1080,breaks:[]}))});}
 const customer=await prisma.customer.create({data:{tenantId:t.id,name:'Fixture',phone:'+905331234567'}});
 const start=new Date(); start.setUTCDate(start.getUTCDate()+3);start.setUTCHours(10,0,0,0);
 const appt=await prisma.appointment.create({data:{tenantId:t.id,serviceId:service.id,staffId:staff[0]!.id,customerId:customer.id,startsAt:start,endsAt:new Date(+start+1800000),blockedUntil:new Date(+start+2400000),priceTry:'125.50',status:'confirmed',cancelToken:crypto.randomUUID()}});
 setQueue(new MemoryQueue());const ctx=await resolveTenantUser({user:{id:owner.id}});
 return {t,service,staff,appt,ctx,next:new Date(+start+86400000)};
}
afterAll(async()=>{setQueue(null);await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
dbit('move rechecks suspended tenant after an earlier active context',async()=>{
 const f=await fixture();await prisma.tenant.update({where:{id:f.t.id},data:{status:'suspended'}});
 await expect(moveAppointment(f.ctx,f.appt.id,{startsAt:f.next})).rejects.toMatchObject({code:'suspended'});
 expect(await prisma.appointment.findUnique({where:{id:f.appt.id}})).toMatchObject({startsAt:f.appt.startsAt,staffId:f.appt.staffId});
});
dbit('same-staff move cannot bypass removed eligibility or inactive service',async()=>{
 for(const mode of ['link','service']){const f=await fixture();if(mode==='link')await prisma.serviceStaff.deleteMany({where:{tenantId:f.t.id}});else await prisma.service.update({where:{id:f.service.id},data:{active:false}});
 await expect(moveAppointment(f.ctx,f.appt.id,{startsAt:f.next})).rejects.toBeDefined();
 expect(await prisma.appointment.findUnique({where:{id:f.appt.id}})).toMatchObject({startsAt:f.appt.startsAt});}
});
dbit('move preserves agreed price/duration/buffer after catalog changes and staff transfer',async()=>{
 const f=await fixture();await prisma.service.update({where:{id:f.service.id},data:{durationMin:60,bufferMin:20,priceTry:'500'}});
 await moveAppointment(f.ctx,f.appt.id,{startsAt:f.next,staffId:f.staff[1]!.id});
 const a=await prisma.appointment.findUniqueOrThrow({where:{id:f.appt.id}});
 expect(a.priceTry.toString()).toBe('125.5');expect(+a.endsAt-+a.startsAt).toBe(1800000);expect(+a.blockedUntil-+a.endsAt).toBe(600000);expect(a.staffId).toBe(f.staff[1]!.id);
});
dbit('foreign target staff and foreign appointment stay inaccessible',async()=>{
 const f=await fixture(),g=await fixture();await expect(moveAppointment(f.ctx,f.appt.id,{startsAt:f.next,staffId:g.staff[0]!.id})).rejects.toMatchObject({code:'not_found'});
 await expect(moveAppointment(f.ctx,g.appt.id,{startsAt:f.next})).rejects.toMatchObject({code:'not_found'});
});
dbit('malformed fractional-minute snapshot is rejected without rounding or mutation',async()=>{
 const f=await fixture();const endsAt=new Date(+f.appt.endsAt+1);await prisma.appointment.update({where:{id:f.appt.id},data:{endsAt}});
 await expect(moveAppointment(f.ctx,f.appt.id,{startsAt:f.next})).rejects.toMatchObject({code:'conflict'});
 expect(await prisma.appointment.findUnique({where:{id:f.appt.id}})).toMatchObject({startsAt:f.appt.startsAt,endsAt});
});

dbit('spring and autumn DST moves preserve elapsed appointment terms',async()=>{
 for(const [before,after,hours] of [['2027-03-27T08:00:00Z','2027-03-28T07:00:00Z',23],['2027-10-30T07:00:00Z','2027-10-31T08:00:00Z',25]] as const){
  const f=await fixture();await prisma.tenant.update({where:{id:f.t.id},data:{timeZone:'Europe/Nicosia'}});
  const start=new Date(before);await prisma.appointment.update({where:{id:f.appt.id},data:{startsAt:start,endsAt:new Date(+start+1800000),blockedUntil:new Date(+start+2400000)}});
  await moveAppointment(f.ctx,f.appt.id,{startsAt:new Date(after),staffId:f.staff[1]!.id});
  const a=await prisma.appointment.findUniqueOrThrow({where:{id:f.appt.id}});
  expect((+a.startsAt-+start)/3600000).toBe(hours);expect(+a.endsAt-+a.startsAt).toBe(1800000);expect(+a.blockedUntil-+a.endsAt).toBe(600000);expect(a.priceTry.toString()).toBe('125.5');
 }
});
dbit('two appointments competing for one moved slot leave the loser unchanged',async()=>{
 const f=await fixture();const b=await prisma.appointment.create({data:{tenantId:f.t.id,serviceId:f.service.id,staffId:f.staff[1]!.id,customerId:f.appt.customerId,startsAt:f.appt.startsAt,endsAt:f.appt.endsAt,blockedUntil:f.appt.blockedUntil,priceTry:'125.50',status:'confirmed',cancelToken:crypto.randomUUID()}});
 const results=await Promise.allSettled([f.appt,b].map(a=>moveAppointment(f.ctx,a.id,{startsAt:f.next,staffId:f.staff[0]!.id})));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const loser=[f.appt,b][results.findIndex(r=>r.status==='rejected')]!;
 expect(await prisma.appointment.findUnique({where:{id:loser.id}})).toMatchObject({startsAt:loser.startsAt,endsAt:loser.endsAt,blockedUntil:loser.blockedUntil,staffId:loser.staffId});
});
dbit('unactivated differing target overrides do not silently change a moved booking',async()=>{
 const f=await fixture();await prisma.serviceStaff.updateMany({where:{tenantId:f.t.id,staffId:f.staff[1]!.id},data:{durationMinOverride:60,priceTryOverride:'300'}});
 await expect(moveAppointment(f.ctx,f.appt.id,{startsAt:f.next,staffId:f.staff[1]!.id})).rejects.toMatchObject({code:'conflict'});
 expect(await prisma.appointment.findUnique({where:{id:f.appt.id}})).toMatchObject({startsAt:f.appt.startsAt,staffId:f.appt.staffId});
});
dbit('in-flight service/staff deactivation is observed before a move commits',async()=>{
 for(const model of ['service','staff'] as const){
  const f=await fixture();let release!:()=>void,ready!:()=>void;const gate=new Promise<void>(r=>release=r),locked=new Promise<void>(r=>ready=r);let writerPid=0;
  const writer=prisma.$transaction(async tx=>{
   writerPid=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`)[0]!.pid;
   if(model==='staff')await tx.staff.update({where:{id:f.appt.staffId},data:{active:false}});else await tx.service.update({where:{id:f.service.id},data:{active:false}});
   ready();await gate;
  });
  await locked;let settled=false;
  const moving=moveAppointment(f.ctx,f.appt.id,{startsAt:f.next}).then(()=>({ok:true}),()=>({ok:false})).finally(()=>{settled=true;});
  try{
   // Release once the old code has committed, or the fixed code is really blocked on this writer.
   let blocked=false;
   for(let i=0;i<80&&!settled&&!blocked;i++){
    const rows=await prisma.$queryRaw<{blocked:boolean}[]>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${writerPid} = ANY(pg_blocking_pids(pid))) AS blocked`;
    blocked=rows[0]!.blocked;if(!blocked&&!settled)await new Promise(r=>setTimeout(r,10));
   }
   expect(settled||blocked).toBe(true);
  }finally{release();await writer;}
  expect((await moving).ok).toBe(false);
  expect(await prisma.appointment.findUnique({where:{id:f.appt.id}})).toMatchObject({startsAt:f.appt.startsAt});
 }
});
dbit('move resource locks reject a mismatched bound tenant',async()=>{
 const f=await fixture(),g=await fixture();const {withTenant,lockMoveResources}=await import('@/lib/db');
 await expect(withTenant(f.t.id).$transaction(tx=>lockMoveResources(tx,g.t.id,g.service.id,g.staff[0]!.id))).rejects.toThrow('Tenant kilidi uyuşmuyor');
});
