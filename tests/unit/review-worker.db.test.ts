import {afterAll,afterEach,expect,it,vi} from "vitest";
try{process.loadEnvFile('.env')}catch{/* local */}
import {prisma} from "@/lib/db";
import {credit} from "@/lib/ledger";
import {MockProvider} from "@/lib/messaging/providers";
import {recoverReviewInvitations} from "@/lib/messaging/review-worker";
const ids:string[]=[];
async function fixture(quiet=false){
 const now=new Date(),completedAt=new Date(+now-10800000),dueAt=new Date(+now-3600000);
 const t=await prisma.tenant.create({data:{slug:`review-worker-${crypto.randomUUID()}`,name:"Fixture",city:"Girne",status:"active",locale:"en",reviewInviteEnabled:true,reviewInviteUrl:"https://g.page/r/C_fixture-1/review",timeZone:"UTC",quietStartHour:quiet?now.getUTCHours():0,quietEndHour:quiet?(now.getUTCHours()+1)%24:0}});ids.push(t.id);
 const s=await prisma.staff.create({data:{tenantId:t.id,name:"Fixture"}}),v=await prisma.service.create({data:{tenantId:t.id,nameTr:"Fixture",durationMin:30,priceTry:"100"}});
 const c=await prisma.customer.create({data:{tenantId:t.id,name:"Fixture",locale:"en",phone:`+90533${String(crypto.getRandomValues(new Uint32Array(1))[0]!%10000000).padStart(7,"0")}`,marketingConsent:true,marketingConsentAt:new Date(+completedAt-1)}});
 const a=await prisma.appointment.create({data:{tenantId:t.id,staffId:s.id,serviceId:v.id,customerId:c.id,status:"completed",completedAt,startsAt:new Date(+completedAt-1800000),endsAt:completedAt,blockedUntil:completedAt,priceTry:"100",cancelToken:crypto.randomUUID()}});
 const r=await prisma.reviewInvitation.create({data:{tenantId:t.id,appointmentId:a.id,customerId:c.id,recipient:c.phone,reviewUrl:t.reviewInviteUrl!,completedAt,dueAt,expiresAt:new Date(+now+86400000)}});await credit(t.id,100);return{t,c,a,r,now};
}
const dbit=it.skipIf(!process.env.DATABASE_URL);
afterEach(()=>vi.restoreAllMocks());afterAll(async()=>{await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
dbit("durable sweep finds a committed intent without enqueue and concurrent sweeps spend once",async()=>{
 const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,cost:1});
 await Promise.all([recoverReviewInvitations({tenantId:f.t.id}),recoverReviewInvitations({tenantId:f.t.id})]);
 expect(send).toHaveBeenCalledTimes(1);expect(await prisma.reviewInvitation.findUnique({where:{id:f.r.id}})).toMatchObject({status:"finished",finishedReason:"sent"});
 expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,delta:{lt:0}}})).toBe(1);
});
dbit("quiet pending survives sweep then expires without sending; disabled legacy intent closes",async()=>{
 const f=await fixture(true),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,cost:1});
 await recoverReviewInvitations({tenantId:f.t.id});expect(await prisma.reviewInvitation.findUnique({where:{id:f.r.id}})).toMatchObject({status:"pending"});
 await recoverReviewInvitations({tenantId:f.t.id,now:f.r.expiresAt});expect(await prisma.reviewInvitation.findUnique({where:{id:f.r.id}})).toMatchObject({status:"skipped",finishedReason:"expired"});
 const g=await fixture();await prisma.tenant.update({where:{id:g.t.id},data:{reviewInviteEnabled:false}});await recoverReviewInvitations({tenantId:g.t.id});
 expect(await prisma.reviewInvitation.findUnique({where:{id:g.r.id}})).toMatchObject({status:"skipped"});expect(send).not.toHaveBeenCalled();
});
dbit("deferred oldest row rotates behind another due row in bounded sweeps",async()=>{
 const f=await fixture(true),g=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,cost:1});
 // Use one owned tenant so this test never sweeps unrelated data.
 await prisma.tenant.update({where:{id:f.t.id},data:{quietStartHour:0,quietEndHour:0}});
 await prisma.appointment.update({where:{id:f.a.id},data:{endsAt:new Date(+f.now+3600000),blockedUntil:new Date(+f.now+3600000)}});
 const s=await prisma.staff.create({data:{tenantId:f.t.id,name:"Other"}}),v=await prisma.service.create({data:{tenantId:f.t.id,nameTr:"Other",durationMin:30,priceTry:"100"}}),c=await prisma.customer.create({data:{tenantId:f.t.id,name:"Other",locale:"en",phone:g.c.phone,marketingConsent:true,marketingConsentAt:g.c.marketingConsentAt}});
 const a=await prisma.appointment.create({data:{tenantId:f.t.id,staffId:s.id,serviceId:v.id,customerId:c.id,status:"completed",completedAt:g.r.completedAt,startsAt:g.a.startsAt,endsAt:g.a.endsAt,blockedUntil:g.a.blockedUntil,priceTry:"100",cancelToken:crypto.randomUUID()}});
 const r=await prisma.reviewInvitation.create({data:{tenantId:f.t.id,appointmentId:a.id,customerId:c.id,recipient:c.phone,reviewUrl:g.r.reviewUrl,completedAt:g.r.completedAt,dueAt:g.r.dueAt,expiresAt:g.r.expiresAt}});
 const now=new Date(Date.now()+1000);await recoverReviewInvitations({tenantId:f.t.id,limit:1,now});await recoverReviewInvitations({tenantId:f.t.id,limit:1,now:new Date(+now+1000)});
 expect(await prisma.reviewInvitation.findUnique({where:{id:r.id}})).toMatchObject({status:"finished"});expect(send).toHaveBeenCalledTimes(1);
});
dbit("provider ambiguity is terminal and periodic sweeps never replay it",async()=>{
 const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockRejectedValue(new Error("ambiguous"));
 await recoverReviewInvitations({tenantId:f.t.id});await recoverReviewInvitations({tenantId:f.t.id,now:new Date(+f.now+180000)});
 expect(send).toHaveBeenCalledTimes(1);expect(await prisma.reviewInvitation.findUnique({where:{id:f.r.id}})).toMatchObject({status:"finished",finishedReason:"delivery_unknown"});
 expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,reason:"refund"}})).toBe(1);
});
dbit("row-local preclaim DB failure remains retryable without partial debit",async()=>{
 const f=await fixture(),suffix=crypto.randomUUID().replaceAll('-',''),fn=`kr_rw_fail_${suffix}`,trigger=`kr_rw_trigger_${suffix}`;
 expect(f.r.id).toMatch(/^[a-z0-9]+$/);const send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,cost:1});
 try{
 await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW.id = '${f.r.id}' AND NEW.status = 'processing' THEN RAISE EXCEPTION 'injected_rw_failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "ReviewInvitation" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
 expect(await recoverReviewInvitations({tenantId:f.t.id})).toMatchObject({errors:1});expect(send).not.toHaveBeenCalled();
 expect(await prisma.reviewInvitation.findUnique({where:{id:f.r.id}})).toMatchObject({status:"pending",messageId:null});expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,delta:{lt:0}}})).toBe(0);
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "ReviewInvitation"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);}
 await recoverReviewInvitations({tenantId:f.t.id});expect(send).toHaveBeenCalledTimes(1);
});
