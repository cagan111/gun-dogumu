import { afterAll, expect, it } from "vitest";
try { process.loadEnvFile(".env"); } catch { /* local fixture */ }
import { prisma, withTenant } from "@/lib/db";
import { resolveTenantUser } from "@/lib/session";
import { setAppointmentStatus } from "@/lib/panel/appointments";
import { updateSettings } from "@/lib/panel/settings";
import { updateVerifiedConsent } from "@/lib/customer-consent";
import { MemoryQueue, setQueue } from "@/jobs/queue";
const ids: string[] = [], url="https://g.page/r/C_fixture-1/review";
async function fixture(enabled=true, consent=true) {
 const t=await prisma.tenant.create({data:{slug:`intent-${crypto.randomUUID()}`,name:"Fixture",city:"Girne",status:"active",reviewInviteEnabled:enabled,reviewInviteUrl:url}});ids.push(t.id);
 const u=await prisma.user.create({data:{tenantId:t.id,email:`${crypto.randomUUID()}@example.test`,name:"Owner",role:"owner"}}),ctx=await resolveTenantUser({user:{id:u.id}});
 const staff=await prisma.staff.create({data:{tenantId:t.id,name:"Staff"}}),svc=await prisma.service.create({data:{tenantId:t.id,nameTr:"Fixture",durationMin:30,priceTry:"100"}});
 const c=await prisma.customer.create({data:{tenantId:t.id,name:"Fixture",phone:"+905331234567"}});
 if(consent)await updateVerifiedConsent(t.id,c.phone,true);
 const now=new Date(),endsAt=new Date(+now+3600000);
 const a=await prisma.appointment.create({data:{tenantId:t.id,staffId:staff.id,serviceId:svc.id,customerId:c.id,startsAt:now,endsAt,blockedUntil:endsAt,priceTry:"100",cancelToken:crypto.randomUUID()}});
 setQueue(new MemoryQueue());return{t,ctx,c,a,now};
}
afterAll(async()=>{setQueue(null);await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
it.skipIf(!process.env.DATABASE_URL)("first eligible completion captures one delayed snapshot; reopening cannot re-arm",async()=>{
 const f=await fixture();await setAppointmentStatus(f.ctx,f.a.id,"completed",f.now);
 const first=await prisma.reviewInvitation.findUnique({where:{appointmentId:f.a.id}});expect(first).not.toBeNull();
 expect(first).toMatchObject({tenantId:f.t.id,customerId:f.c.id,recipient:f.c.phone,reviewUrl:url,status:"pending",completedAt:f.now,dueAt:new Date(+f.a.endsAt+7200000),expiresAt:new Date(+f.a.endsAt+93600000)});
 await setAppointmentStatus(f.ctx,f.a.id,"completed",new Date(+f.now+60000));expect(await prisma.reviewInvitation.count({where:{appointmentId:f.a.id}})).toBe(1);
 expect(await prisma.messageLog.count({where:{tenantId:f.t.id}})).toBe(0);expect(await prisma.smsLedger.count({where:{tenantId:f.t.id}})).toBe(0);
 await setAppointmentStatus(f.ctx,f.a.id,"confirmed",new Date(+f.now+120000));
 expect(await prisma.reviewInvitation.findUnique({where:{appointmentId:f.a.id}})).toMatchObject({id:first!.id,status:"skipped",finishedReason:"appointment_changed"});
 await setAppointmentStatus(f.ctx,f.a.id,"completed",new Date(+f.now+180000));expect(await prisma.reviewInvitation.findUnique({where:{appointmentId:f.a.id}})).toMatchObject({id:first!.id,status:"skipped"});
 const other=await fixture();expect(await withTenant(other.t.id).reviewInvitation.count({where:{appointmentId:f.a.id}})).toBe(0);
});
it.skipIf(!process.env.DATABASE_URL)("late setting/consent does not manufacture a historical invite",async()=>{
 for(const [enabled,consent] of [[false,true],[true,false]] as const){const f=await fixture(enabled,consent);await setAppointmentStatus(f.ctx,f.a.id,"completed",f.now);expect(await prisma.reviewInvitation.count({where:{appointmentId:f.a.id}})).toBe(0);
 await updateSettings(f.ctx,{reviewInviteEnabled:true});await updateVerifiedConsent(f.t.id,f.c.phone,true);await setAppointmentStatus(f.ctx,f.a.id,"confirmed");await setAppointmentStatus(f.ctx,f.a.id,"completed");expect(await prisma.reviewInvitation.count({where:{appointmentId:f.a.id}})).toBe(0);}
});
it.skipIf(!process.env.DATABASE_URL)("intent DB failure rolls completion and first timestamp back",async()=>{
 const f=await fixture(),suffix=crypto.randomUUID().replaceAll("-","");expect(f.t.id).toMatch(/^[a-z0-9]+$/);
 const fn=`kr_review_fail_${suffix}`,trigger=`kr_review_trigger_${suffix}`;
 try{
 await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW."tenantId" = '${f.t.id}' THEN RAISE EXCEPTION 'injected_review_failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "ReviewInvitation" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
 await expect(setAppointmentStatus(f.ctx,f.a.id,"completed",f.now)).rejects.toThrow();
 expect(await prisma.appointment.findUnique({where:{id:f.a.id}})).toMatchObject({status:"confirmed",completedAt:null});expect(await prisma.reviewInvitation.count({where:{appointmentId:f.a.id}})).toBe(0);
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "ReviewInvitation"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);}
});

it.skipIf(!process.env.DATABASE_URL)("withdrawal/setting disable/URL change permanently skip pending snapshots",async()=>{
 for(const kind of ["consent","disabled","url"] as const){const f=await fixture();await setAppointmentStatus(f.ctx,f.a.id,"completed",f.now);
 const before=await prisma.reviewInvitation.findUniqueOrThrow({where:{appointmentId:f.a.id}});
 if(kind==="consent"){await updateVerifiedConsent(f.t.id,f.c.phone,false);await updateVerifiedConsent(f.t.id,f.c.phone,true);}
 if(kind==="disabled"){await updateSettings(f.ctx,{reviewInviteEnabled:false});await updateSettings(f.ctx,{reviewInviteEnabled:true});}
 if(kind==="url"){await updateSettings(f.ctx,{reviewInviteUrl:"https://g.page/r/C_fixture-2/review"});await updateSettings(f.ctx,{reviewInviteUrl:url});}
 expect(await prisma.reviewInvitation.findUnique({where:{appointmentId:f.a.id}})).toMatchObject({id:before.id,status:"skipped",recipient:before.recipient,reviewUrl:before.reviewUrl,dueAt:before.dueAt,finishedReason:kind==="consent"?"consent_withdrawn":kind==="disabled"?"settings_disabled":"url_changed"});
 expect(await prisma.messageLog.count({where:{tenantId:f.t.id}})).toBe(0);expect(await prisma.smsLedger.count({where:{tenantId:f.t.id}})).toBe(0);}
});
it.skipIf(!process.env.DATABASE_URL)("stale active context, invalid stored URL and unverified legacy boolean cannot arm an invite",async()=>{
 const suspended=await fixture();await prisma.tenant.update({where:{id:suspended.t.id},data:{status:"suspended"}});
 await expect(setAppointmentStatus(suspended.ctx,suspended.a.id,"completed",suspended.now)).rejects.toMatchObject({code:"suspended"});
 expect(await prisma.reviewInvitation.count({where:{appointmentId:suspended.a.id}})).toBe(0);expect(await prisma.appointment.findUnique({where:{id:suspended.a.id}})).toMatchObject({status:"confirmed",completedAt:null});
 for(const legacy of ["url","consent"] as const){const f=await fixture();
 if(legacy==="url")await prisma.tenant.update({where:{id:f.t.id},data:{reviewInviteUrl:"https://evil.example/review"}});
 else await prisma.customer.update({where:{id:f.c.id},data:{marketingConsent:true,marketingConsentAt:null}});
 await setAppointmentStatus(f.ctx,f.a.id,"completed",f.now);expect(await prisma.reviewInvitation.count({where:{appointmentId:f.a.id}})).toBe(0);}
});
