import { afterAll, afterEach, expect, it, vi } from "vitest";
try { process.loadEnvFile(".env"); } catch { /* local fixture */ }
import { prisma } from "@/lib/db";
import { credit } from "@/lib/ledger";
import { sendMessage, reconcileQueuedMessages } from "@/lib/messaging/send";
import { MockProvider } from "@/lib/messaging/providers";
import { updateVerifiedConsent } from "@/lib/customer-consent";
const ids: string[]=[];
const url="https://g.page/r/C_fixture-1/review";
async function fixture() {
 const now=new Date(), completedAt=new Date(+now-10800000), dueAt=new Date(+now-3600000);
 const t=await prisma.tenant.create({data:{slug:`dispatch-${crypto.randomUUID()}`,name:"Fixture",city:"Girne",status:"active",locale:"en",quietStartHour:0,quietEndHour:0,reviewInviteEnabled:true,reviewInviteUrl:url}});ids.push(t.id);
 const staff=await prisma.staff.create({data:{tenantId:t.id,name:"Staff"}}),svc=await prisma.service.create({data:{tenantId:t.id,nameTr:"Fixture",durationMin:30,priceTry:"100"}});
 const phone=`+90533${String(crypto.getRandomValues(new Uint32Array(1))[0]!%10000000).padStart(7,"0")}`;
 const c=await prisma.customer.create({data:{tenantId:t.id,name:"Fixture",phone,locale:"en",marketingConsent:true,marketingConsentAt:new Date(+completedAt-60000)}});
 const a=await prisma.appointment.create({data:{tenantId:t.id,staffId:staff.id,serviceId:svc.id,customerId:c.id,status:"completed",completedAt,startsAt:new Date(+completedAt-1800000),endsAt:completedAt,blockedUntil:completedAt,priceTry:"100",cancelToken:crypto.randomUUID()}});
 const intent=await prisma.reviewInvitation.create({data:{tenantId:t.id,appointmentId:a.id,customerId:c.id,recipient:phone,reviewUrl:url,completedAt,dueAt,expiresAt:new Date(+now+86400000)}});
 await credit(t.id,100);
 const input={tenantId:t.id,to:phone,text:`Fixture: Would you like to share your experience? ${url}`,template:"review_invite",reason:"notification" as const,appointmentId:a.id,idempotencyKey:`review:${a.id}`,reviewInvitationId:intent.id,deps:{env:{SMS_PROVIDER:"mock",ALLOW_REAL_SMS:"false",SMS_APPROVED_SENDERS_JSON:"{}"}},now};
 return {t,c,a,intent,input,now};
}
const dbit=it.skipIf(!process.env.DATABASE_URL);
afterEach(()=>vi.restoreAllMocks());
afterAll(async()=>{await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
dbit("review claim atomically links one intent/message/debit under concurrent send",async()=>{
 const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 const results=await Promise.all([sendMessage(f.input),sendMessage(f.input)]);
 expect(results.map(r=>r.status).sort()).toEqual(["duplicate","sent"]);expect(send).toHaveBeenCalledTimes(1);
 const message=await prisma.messageLog.findFirstOrThrow({where:{tenantId:f.t.id}});
 expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"finished",messageId:message.id,finishedReason:"sent"});
 expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,delta:{lt:0}}})).toBe(1);
});
dbit("not due and quiet defer without message/debit; expiry permanently skips",async()=>{
 for(const kind of ["due","quiet","expired"]){const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 if(kind==="due")f.input.now=new Date(+f.intent.dueAt-60000);
 if(kind==="quiet")await prisma.tenant.update({where:{id:f.t.id},data:{timeZone:"UTC",quietStartHour:f.now.getUTCHours(),quietEndHour:(f.now.getUTCHours()+1)%24}});
 if(kind==="expired")f.input.now=f.intent.expiresAt;
 expect((await sendMessage(f.input)).status).toBe("skipped");expect(send).not.toHaveBeenCalled();
 expect(await prisma.messageLog.count({where:{tenantId:f.t.id}})).toBe(0);
 expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:kind==="expired"?"skipped":"pending"});vi.restoreAllMocks();}
});
dbit("claim then opt-out/re-opt-in cancels before provider, refunds once and keeps attempt budget",async()=>{
 const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 await sendMessage({...f.input,hooks:{afterReserved:async()=>{await updateVerifiedConsent(f.t.id,f.c.phone,false);await updateVerifiedConsent(f.t.id,f.c.phone,true);}}});
 expect(send).not.toHaveBeenCalled();
 expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"skipped",finishedReason:"consent_withdrawn"});
 const message=await prisma.messageLog.findFirstOrThrow({where:{tenantId:f.t.id}});expect(message).toMatchObject({status:"failed",cost:0,dispatchStartedAt:null});expect(message.smsSafetySegments).toBeGreaterThan(0);
 expect(await prisma.smsLedger.count({where:{messageId:message.id,reason:"refund"}})).toBe(1);
 expect((await sendMessage(f.input)).status).toBe("duplicate");await reconcileQueuedMessages(new Date(+f.now+180000),100,f.t.id);
 expect(await prisma.smsLedger.count({where:{messageId:message.id,reason:"refund"}})).toBe(1);
});
dbit("ambiguous provider result finishes once; interrupted reservation recovers without replay",async()=>{
 for(const crash of [false,true]){const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockRejectedValue(new Error("network"));
 if(crash)await expect(sendMessage({...f.input,hooks:{afterReserved:async()=>{throw new Error("interrupted");}}})).rejects.toThrow("interrupted");
 else expect(await sendMessage(f.input)).toMatchObject({status:"failed",reason:"delivery_unknown"});
 await reconcileQueuedMessages(new Date(+f.now+180000),100,f.t.id);
 expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"finished",finishedReason:crash?"interrupted_before_dispatch":"delivery_unknown"});
 expect((await sendMessage(f.input)).status).toBe("duplicate");expect(send).toHaveBeenCalledTimes(crash?0:1);
 expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,reason:"refund"}})).toBe(1);vi.restoreAllMocks();}
});
dbit("wrong payload and unbound template cannot bypass durable invitation",async()=>{
 const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 for(const input of [{...f.input,reviewInvitationId:undefined},{...f.input,text:"arbitrary"},{...f.input,idempotencyKey:"wrong"},{...f.input,reason:"campaign" as const}])await expect(sendMessage(input)).rejects.toThrow();
 expect(send).not.toHaveBeenCalled();expect(await prisma.messageLog.count({where:{tenantId:f.t.id}})).toBe(0);
});
dbit("current URL/status/phone/verified consent blocks before claim, without a debit",async()=>{
 for(const kind of ["url","suspended","phone","unverified"]){const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 if(kind==="url")await prisma.tenant.update({where:{id:f.t.id},data:{reviewInviteUrl:"https://g.page/r/C_other/review"}});
 if(kind==="suspended")await prisma.tenant.update({where:{id:f.t.id},data:{status:"suspended"}});
 if(kind==="phone")await prisma.customer.update({where:{id:f.c.id},data:{phone:"+905551234567"}});
 if(kind==="unverified")await prisma.customer.update({where:{id:f.c.id},data:{marketingConsentAt:null}});
 expect((await sendMessage(f.input)).status).toBe("skipped");expect(send).not.toHaveBeenCalled();
 expect(await prisma.messageLog.count({where:{tenantId:f.t.id}})).toBe(0);expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"skipped"});vi.restoreAllMocks();}
});
dbit("no-credit review never falls back; sender revocation after claim refunds without dispatch",async()=>{
 const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 await prisma.smsLedger.deleteMany({where:{tenantId:f.t.id}});
 expect((await sendMessage({...f.input,fallback:{email:"fixture@example.test",whatsapp:true}})).status).toBe("skipped");
 expect(await prisma.messageLog.count({where:{tenantId:f.t.id}})).toBe(0);expect(send).not.toHaveBeenCalled();
 const g=await fixture();await sendMessage({...g.input,hooks:{afterReserved:async()=>{await prisma.tenant.update({where:{id:g.t.id},data:{smsSenderName:"BANKA"}});}}});
 expect(send).not.toHaveBeenCalled();expect(await prisma.smsLedger.count({where:{tenantId:g.t.id,reason:"refund"}})).toBe(1);
 expect(await prisma.reviewInvitation.findUnique({where:{id:g.intent.id}})).toMatchObject({status:"skipped",finishedReason:"sms_sender_not_approved"});
});
dbit("started provider attempt cannot be recalled by later opt-out",async()=>{
 const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 expect(await sendMessage({...f.input,hooks:{afterDispatch:()=>updateVerifiedConsent(f.t.id,f.c.phone,false).then(()=>{})}})).toMatchObject({status:"sent"});
 expect(send).toHaveBeenCalledTimes(1);expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"finished",finishedReason:"sent"});
 expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,reason:"refund"}})).toBe(0);
});
dbit("scoped claim-write failure rolls MessageLog and debit back together",async()=>{
 const f=await fixture(),suffix=crypto.randomUUID().replaceAll("-",""),fn=`kr_claim_fail_${suffix}`,trigger=`kr_claim_trigger_${suffix}`;
 expect(f.intent.id).toMatch(/^[a-z0-9]+$/);const send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 try {
 await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW.id = '${f.intent.id}' AND NEW.status = 'processing' THEN RAISE EXCEPTION 'injected_claim_failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "ReviewInvitation" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
 await expect(sendMessage(f.input)).rejects.toThrow();expect(send).not.toHaveBeenCalled();
 expect(await prisma.messageLog.count({where:{tenantId:f.t.id}})).toBe(0);expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,delta:{lt:0}}})).toBe(0);
 expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"pending",messageId:null});
 } finally {await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "ReviewInvitation"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);}
});
dbit("unapproved sender is terminal; country and immutable tenant budget still apply",async()=>{
 for(const kind of ["sender","country","budget"]){const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 if(kind==="sender")await prisma.tenant.update({where:{id:f.t.id},data:{smsSenderName:"BANKA"}});
 if(kind==="country")await prisma.tenant.update({where:{id:f.t.id},data:{smsAllowedCallingCodes:["44"]}});
 if(kind==="budget")await prisma.tenant.update({where:{id:f.t.id},data:{smsDailySegmentLimit:1}});
 const input=kind==="budget"?{...f.input,text:f.input.text}:f.input;
 // Force budget usage independently of this invite's segment length.
 if(kind==="budget")await prisma.messageLog.create({data:{tenantId:f.t.id,channel:"sms",recipient:f.c.phone,template:"fixture",content:"fixture",provider:"mock",status:"failed",cost:0,smsSafetySegments:1,createdAt:f.now}});
 expect((await sendMessage(input)).status).toBe("skipped");expect(send).not.toHaveBeenCalled();
 expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"skipped",messageId:null});
 expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,delta:{lt:0}}})).toBe(0);vi.restoreAllMocks();}
});
dbit("settings off/on and appointment reopen permanently cancel unstarted claims",async()=>{
 const {resolveTenantUser}=await import("@/lib/session"),{updateSettings}=await import("@/lib/panel/settings"),{setAppointmentStatus}=await import("@/lib/panel/appointments");
 const {MemoryQueue,setQueue}=await import("@/jobs/queue");setQueue(new MemoryQueue());
 try{for(const kind of ["settings","appointment"]){const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 const u=await prisma.user.create({data:{tenantId:f.t.id,email:`${crypto.randomUUID()}@example.test`,name:"Owner",role:"owner"}}),ctx=await resolveTenantUser({user:{id:u.id}});
 await sendMessage({...f.input,hooks:{afterReserved:async()=>{
 if(kind==="settings"){await updateSettings(ctx,{reviewInviteEnabled:false});await updateSettings(ctx,{reviewInviteEnabled:true});}
 else{await setAppointmentStatus(ctx,f.a.id,"confirmed");await setAppointmentStatus(ctx,f.a.id,"completed");}
 }}});
 expect(send).not.toHaveBeenCalled();expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"skipped",finishedReason:kind==="settings"?"settings_disabled":"appointment_changed"});
 expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,reason:"refund"}})).toBe(1);vi.restoreAllMocks();}
 }finally{setQueue(null);}
});
dbit("current expiry, quiet hours and legacy URL changes are checked again after reservation",async()=>{
 for(const kind of ["expired","quiet","url"]){const f=await fixture(),send=vi.spyOn(MockProvider.prototype,"send").mockResolvedValue({ok:true,providerId:"fixture",cost:1});
 await sendMessage({...f.input,hooks:{afterReserved:async()=>{
 if(kind==="expired")await prisma.reviewInvitation.update({where:{id:f.intent.id},data:{expiresAt:f.now}});
 if(kind==="quiet")await prisma.tenant.update({where:{id:f.t.id},data:{timeZone:"UTC",quietStartHour:f.now.getUTCHours(),quietEndHour:(f.now.getUTCHours()+1)%24}});
 if(kind==="url")await prisma.tenant.update({where:{id:f.t.id},data:{reviewInviteUrl:"https://g.page/r/C_other/review"}});
 }}});
 expect(send).not.toHaveBeenCalled();expect(await prisma.reviewInvitation.findUnique({where:{id:f.intent.id}})).toMatchObject({status:"skipped",finishedReason:kind==="quiet"?"quiet_hours":kind==="url"?"url_changed":"expired"});
 expect(await prisma.smsLedger.count({where:{tenantId:f.t.id,reason:"refund"}})).toBe(1);vi.restoreAllMocks();}
});
