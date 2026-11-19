import {describe,it,expect} from 'vitest';
import {scopeArgs} from '@/lib/tenant';
describe('T118 unsupported operations fail closed',()=>{
 it('rejects nested secret reads and scoped user writes',()=>{expect(()=>scopeArgs('Staff','findMany',{include:{user:true}},'a')).toThrow();expect(()=>scopeArgs('User','findMany',{include:{loginTokens:true}},'a')).toThrow();expect(()=>scopeArgs('User','update',{data:{role:'superadmin'}},'a')).toThrow();});
 it.each(['futureOperation','findRaw','aggregateRaw'])('rejects %s',(op)=>{expect(()=>scopeArgs('Customer',op,{},'a')).toThrow();});
 it.each(['create','update','upsert'])('rejects relation mutations in %s',(op)=>{expect(()=>scopeArgs('Customer',op,{data:{appointments:{create:{tenantId:'b'}}},create:{appointments:{connect:{id:'b'}}}},'a')).toThrow();});
 it('rejects tenant reassignment through update and upsert update',()=>{expect(()=>scopeArgs('Customer','update',{data:{tenantId:'b'}},'a')).toThrow();expect(()=>scopeArgs('Customer','upsert',{update:{tenantId:{set:'b'}}} as never,'a')).toThrow();});
 it('scopes root tenant and user reads, rejects global secret models',()=>{expect(scopeArgs('Tenant','findMany',{},'a').where).toEqual({id:'a'});expect(()=>scopeArgs('User','findMany',{},'a')).toThrow();expect(()=>scopeArgs('LoginToken','findMany',{},'a')).toThrow();});
});
