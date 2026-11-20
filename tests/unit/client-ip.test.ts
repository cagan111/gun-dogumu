import {afterEach,describe,it,expect,vi} from 'vitest';
import {clientIp} from '@/lib/http';
import {envProblems} from '@/lib/env';
afterEach(()=>vi.unstubAllEnvs());
const req=(headers:Record<string,string>)=>new Request('http://localhost',{headers});
describe('T146A authenticated proxy IP',()=>{
 it('rejects missing, short or reused proxy configuration',()=>{const base={DATABASE_URL:'fixture',NEXTAUTH_SECRET:'b'.repeat(64),TRUST_PROXY:'true'};for(const secret of [undefined,'short',base.NEXTAUTH_SECRET])expect(envProblems({...base,PROXY_SHARED_SECRET:secret}).some(p=>p.key==='PROXY_SHARED_SECRET')).toBe(true);expect(envProblems({...base,PROXY_SHARED_SECRET:'a'.repeat(64)})).toEqual([])});
 it('ignores user forwarding headers by default',()=>{vi.stubEnv('TRUST_PROXY','false');expect(clientIp(req({'x-forwarded-for':'203.0.113.1','x-real-ip':'203.0.113.2'}))).toBe('unknown')});
 it('requires a matching private proxy token even with trust enabled',()=>{vi.stubEnv('TRUST_PROXY','true');vi.stubEnv('PROXY_SHARED_SECRET','a'.repeat(64));expect(clientIp(req({'x-real-ip':'203.0.113.1'}))).toBe('unknown');expect(clientIp(req({'x-real-ip':'203.0.113.1','x-kr-proxy-token':'wrong'}))).toBe('unknown')});
 it('accepts only authenticated single valid real IP, never XFF',()=>{vi.stubEnv('TRUST_PROXY','true');vi.stubEnv('PROXY_SHARED_SECRET','a'.repeat(64));expect(clientIp(req({'x-real-ip':'203.0.113.1','x-forwarded-for':'198.51.100.1','x-kr-proxy-token':'a'.repeat(64)}))).toBe('203.0.113.1');for(const ip of ['garbage','203.0.113.1, 203.0.113.2','203.0.113.1:80'])expect(clientIp(req({'x-real-ip':ip,'x-kr-proxy-token':'a'.repeat(64)}))).toBe('unknown')});
});
