import {afterEach,describe,it,expect,vi} from 'vitest';
import * as otp from '@/lib/otp';
import {MemoryQueue,setQueue} from '@/jobs/queue';
afterEach(()=>setQueue(null));
describe('T146B1 OTP response decoupled from delivery',()=>{
 it('queues every valid phone with same non-secret payload without issuing codes',async()=>{const q=new MemoryQueue();setQueue(q);const request=(otp as unknown as {enqueueOtpRequest:(t:string,p:string)=>Promise<unknown>}).enqueueOtpRequest;expect(typeof request).toBe('function');expect(await request('fixture','+905331234567')).toEqual({sent:true});expect(await request('fixture','+905331234568')).toEqual({sent:true});expect(q.jobs).toHaveLength(2);for(const j of q.jobs){expect(Object.keys(j.data).sort()).toEqual(['phone','requestedAt','tenantId']);expect(j.name).toBe('request-otp')}});
 it('queue failure is generic and never falls back to synchronous delivery',async()=>{const enqueue=vi.fn().mockRejectedValue(new Error('fixture offline'));setQueue({enqueue});const request=(otp as unknown as {enqueueOtpRequest:(t:string,p:string)=>Promise<unknown>}).enqueueOtpRequest;expect(typeof request).toBe('function');await expect(request('fixture','+905331234569')).rejects.toMatchObject({code:'sms_unavailable'})});
});
