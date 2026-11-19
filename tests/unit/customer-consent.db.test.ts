import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {prisma,withTenant} from '@/lib/db';
import {getVerifiedConsent,updateVerifiedConsent,optOutCustomer,optOutSchema} from '@/lib/customer-consent';
import {sendCampaign,processCampaign,cancelCampaign} from '@/lib/messaging/campaign';
import type {PanelCtx} from '@/lib/panel-auth';
try{process.loadEnvFile('.env')}catch{ /* optional env */ }
let id='',other='',customerId='';const phone='+905339992222';
describe.skipIf(!process.env.DATABASE_URL)('T144 consent decisions and isolation',()=>{
 beforeAll(async()=>{const t=await prisma.tenant.create({data:{slug:`consent-${crypto.randomUUID()}`,name:'Fixture',city:'Girne',plan:'salon_plus',quietStartHour:0,quietEndHour:0}});id=t.id;const b=await prisma.tenant.create({data:{slug:`consent-${crypto.randomUUID()}`,name:'Other',city:'Girne'}});other=b.id;customerId=(await prisma.customer.create({data:{tenantId:id,phone,name:'Fixture'}})).id;await prisma.smsLedger.create({data:{tenantId:id,delta:20,balanceAfter:20,reason:'package_purchase'}})});
 afterAll(async()=>{await prisma.auditLog.deleteMany({where:{tenantId:{in:[id,other]}}});await prisma.tenant.deleteMany({where:{id:{in:[id,other]}}})});
 const ctx=(tenantId=id,role='owner')=>({tenantId,tenantStatus:'suspended',db:withTenant(tenantId),user:{id:'fixture-owner',role}} as PanelCtx);
 it('verified changes audited once; another tenant cannot change same phone',async()=>{await updateVerifiedConsent(id,phone,true);await updateVerifiedConsent(id,phone,true);expect(await getVerifiedConsent(id,phone)).toEqual({marketingConsent:true});expect(await prisma.auditLog.count({where:{tenantId:id,action:'customer.marketing_consent'}})).toBe(1);await expect(updateVerifiedConsent(other,phone,false)).rejects.toMatchObject({code:'not_found'})});
 it('owner can withdraw even suspended; staff/foreign ids and opt-in rejected',async()=>{expect(optOutSchema.safeParse({marketingConsent:true}).success).toBe(false);await expect(optOutCustomer(ctx(id,'staff'),customerId)).rejects.toMatchObject({code:'forbidden'});await expect(optOutCustomer(ctx(other),customerId)).rejects.toMatchObject({code:'not_found'});await optOutCustomer(ctx(),customerId);expect(await getVerifiedConsent(id,phone)).toEqual({marketingConsent:false});await optOutCustomer(ctx(),customerId);expect(await prisma.auditLog.count({where:{tenantId:id,action:'customer.marketing_consent'}})).toBe(2)});
 it('revocation after campaign snapshot prevents unclaimed sends and releases hold',async()=>{await updateVerifiedConsent(id,phone,true);const c=await sendCampaign(id,'Consent fixture',new Date(),undefined,{idempotencyKey:crypto.randomUUID(),maxRecipients:0});await updateVerifiedConsent(id,phone,false);await processCampaign(id,c.campaignId);expect(await prisma.messageLog.count({where:{tenantId:id}})).toBe(0);expect((await prisma.campaign.findUniqueOrThrow({where:{id:c.campaignId}})).remainingReserved).toBe(0);expect((await prisma.campaignRecipient.findFirstOrThrow({where:{campaignId:c.campaignId}})).status).toBe('skipped')});
 it('withdrawal after claim but before dispatch skips and refunds once',async()=>{
 await updateVerifiedConsent(id,phone,true);
 const before=await prisma.smsLedger.aggregate({where:{tenantId:id},_sum:{delta:true}});
 const c=await sendCampaign(id,'Claim race fixture',new Date(),undefined,{idempotencyKey:crypto.randomUUID(),sendHooks:{afterReserved:async()=>{await updateVerifiedConsent(id,phone,false)}}});
 expect(c.skipped).toBe(1);expect(c.sent).toBe(0);
 expect((await prisma.smsLedger.aggregate({where:{tenantId:id},_sum:{delta:true}}))._sum.delta).toBe(before._sum.delta);
 const msg=await prisma.messageLog.findFirstOrThrow({where:{tenantId:id,template:'campaign'}});expect(msg.dispatchStartedAt).toBeNull();expect(msg.providerResult).toBe('consent_withdrawn');await processCampaign(id,c.campaignId);expect((await prisma.smsLedger.aggregate({where:{tenantId:id},_sum:{delta:true}}))._sum.delta).toBe(before._sum.delta);
 });

 it('cancel remaining after claim prevents an unstarted campaign dispatch',async()=>{
 await updateVerifiedConsent(id,phone,true);
 const before=await prisma.smsLedger.aggregate({where:{tenantId:id},_sum:{delta:true}});
 const key=crypto.randomUUID();const c=await sendCampaign(id,'Cancel race fixture',new Date(),undefined,{idempotencyKey:key,sendHooks:{afterReserved:async()=>{await cancelCampaign(id,key)}}});
 expect(c).toMatchObject({sent:0,skipped:1,pending:0});
 const r=await prisma.campaignRecipient.findFirstOrThrow({where:{campaignId:c.campaignId}});const m=await prisma.messageLog.findUniqueOrThrow({where:{id:r.messageId!}});expect(m.providerResult).toBe('campaign_cancelled');expect(m.dispatchStartedAt).toBeNull();
 expect((await prisma.smsLedger.aggregate({where:{tenantId:id},_sum:{delta:true}}))._sum.delta).toBe(before._sum.delta);
 });

});
