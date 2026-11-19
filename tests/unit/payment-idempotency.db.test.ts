import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { recordManualPayment, paymentSchema } from '@/lib/billing/payments';
try { process.loadEnvFile('.env'); } catch { /* optional local env */ }
const ids: string[] = [];
const now = new Date('2026-11-19T12:00:00Z');
async function fixture() { const t = await prisma.tenant.create({data:{slug:`pay-${randomUUID()}`,name:'Fixture',city:'Girne',phone:'+905331110000',plan:'pro'}}); ids.push(t.id); return t.id; }
function input(tenantId:string,key=randomUUID()) { return {tenantId,amountTry:1250,months:1,idempotencyKey:key}; }
describe.skipIf(!process.env.DATABASE_URL)('T117 manual payment durable idempotency',()=>{
 afterAll(async()=>{await prisma.auditLog.deleteMany({where:{tenantId:{in:ids}}});await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
 it('lost response and later replay return original result, one extension/payment/audit',async()=>{
 const tenantId=await fixture(), b=input(tenantId);const first=await recordManualPayment({id:'fixture-admin'},b,now);
 await prisma.tenant.update({where:{id:tenantId},data:{plan:'salon_plus'}});
 const replay=await recordManualPayment({id:'fixture-admin'},b,new Date(+now+86400000));
 expect(replay).toEqual(first);expect(await prisma.payment.count({where:{tenantId}})).toBe(1);
 expect(await prisma.auditLog.count({where:{tenantId,action:'payment.record'}})).toBe(1);
 expect((await prisma.tenant.findUniqueOrThrow({where:{id:tenantId}})).subscriptionEndsAt).toEqual(first.subscriptionEndsAt);
 });
 it('parallel same key extends once',async()=>{const tenantId=await fixture(),b=input(tenantId);const r=await Promise.all([recordManualPayment({id:'fixture-admin'},b,now),recordManualPayment({id:'fixture-admin'},b,now)]);expect(r[0]).toEqual(r[1]);expect(await prisma.payment.count({where:{tenantId}})).toBe(1);});
 it('same key changed payload conflicts without effects; another tenant has own key',async()=>{const tenantId=await fixture(),b=input(tenantId);await recordManualPayment({id:'fixture-admin'},b,now);await expect(recordManualPayment({id:'fixture-admin'},{...b,months:2},now)).rejects.toMatchObject({code:'conflict'});expect(await prisma.payment.count({where:{tenantId}})).toBe(1);const other=await fixture();await expect(recordManualPayment({id:'fixture-admin'},{...b,tenantId:other},now)).resolves.toBeTruthy();});
 it('schema and direct service reject missing key',async()=>{const tenantId=await fixture();expect(paymentSchema.safeParse({tenantId,amountTry:100,months:1}).success).toBe(false);await expect(recordManualPayment({id:'fixture-admin'},{tenantId,amountTry:100,months:1} as never,now)).rejects.toBeTruthy();expect(await prisma.payment.count({where:{tenantId}})).toBe(0);});
 it('new key is a new explicit payment; old key cannot be reused by another actor',async()=>{
 const tenantId=await fixture(),b=input(tenantId);const a=await recordManualPayment({id:'fixture-admin'},b,now);
 await expect(recordManualPayment({id:'other-admin'},b,now)).rejects.toMatchObject({code:'conflict'});
 const second=await recordManualPayment({id:'fixture-admin'},input(tenantId),now);
 expect(second.paymentId).not.toBe(a.paymentId);expect(second.subscriptionEndsAt.getTime()).toBeGreaterThan(a.subscriptionEndsAt.getTime());
 expect(await prisma.payment.count({where:{tenantId}})).toBe(2);
 });
 it('rejects fractional kurus and changed note without extending',async()=>{
 const tenantId=await fixture(),b={...input(tenantId),note:'cash fixture'};await recordManualPayment({id:'fixture-admin'},b,now);
 await expect(recordManualPayment({id:'fixture-admin'},{...b,note:'different'},now)).rejects.toMatchObject({code:'conflict'});
 expect(paymentSchema.safeParse({...b,amountTry:1.001}).success).toBe(false);
 expect(await prisma.payment.count({where:{tenantId}})).toBe(1);
 });

});
