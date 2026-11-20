import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {prisma} from '@/lib/db';
import {handleOtpRequest} from '@/jobs/handlers';
try{process.loadEnvFile('.env')}catch{ /* optional env */ }
let tenantId='';const phone='+905331234567';
describe.skipIf(!process.env.DATABASE_URL)('T146B1 worker OTP delivery',()=>{
 beforeAll(async()=>{tenantId=(await prisma.tenant.create({data:{slug:`otp-worker-${crypto.randomUUID()}`,name:'Fixture',city:'Girne'}})).id;await prisma.customer.create({data:{tenantId,phone,name:'Fixture'}})});
 afterAll(async()=>{await prisma.tenant.deleteMany({where:{id:tenantId}})});
 it('fresh known job issues code only in worker; unknown job produces no code',async()=>{const send=vi.fn().mockResolvedValue(undefined);const now=new Date();const result=await handleOtpRequest({tenantId,phone,requestedAt:now.toISOString()},{now,send});expect(result).toEqual({status:'processed'});expect(send).toHaveBeenCalledOnce();expect((await prisma.otp.findFirstOrThrow({where:{tenantId,phone}})).codeHash).not.toBe(send.mock.calls[0]?.[2]);await handleOtpRequest({tenantId,phone:'+905331234568',requestedAt:now.toISOString()},{now,send});expect(send).toHaveBeenCalledOnce()});
 it('stale queued requests cannot replace an active code',async()=>{const before=await prisma.otp.findFirstOrThrow({where:{tenantId,phone}});const send=vi.fn();const now=new Date(+before.createdAt+61000);expect(await handleOtpRequest({tenantId,phone,requestedAt:before.createdAt.toISOString()},{now,send})).toEqual({status:'skipped'});expect(send).not.toHaveBeenCalled();expect((await prisma.otp.findFirstOrThrow({where:{tenantId,phone}})).id).toBe(before.id)});
 it('suspended salon cannot dispatch queued OTP',async()=>{await prisma.tenant.update({where:{id:tenantId},data:{status:'suspended'}});const send=vi.fn();expect(await handleOtpRequest({tenantId,phone,requestedAt:new Date().toISOString()},{send})).toEqual({status:'skipped'});expect(send).not.toHaveBeenCalled()});
});
