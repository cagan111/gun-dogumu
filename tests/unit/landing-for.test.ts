import {afterEach,describe,it,expect,vi} from 'vitest';
import {landingFor} from '@/app/giris/login-forms';
afterEach(()=>vi.unstubAllGlobals());
describe('T143 client redirect boundary',()=>{
 it('revalidates untrusted input and falls back by authenticated role',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({json:async()=>({user:{role:'superadmin'}})}));expect(await landingFor('/\t/evil.example')).toBe('/admin')});
 it('keeps a valid local destination without fetching',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);expect(await landingFor('/panel?day=1')).toBe('/panel?day=1');expect(f).not.toHaveBeenCalled()});
 it('uses local fallback when session request fails',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));expect(await landingFor('//evil.example')).toBe('/panel')});
});
