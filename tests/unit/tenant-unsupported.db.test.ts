import {afterAll,describe,it,expect} from 'vitest';
import {prisma,withTenant} from '@/lib/db';
try {process.loadEnvFile('.env');} catch { /* optional local env */ }
const ids:string[]=[];
describe.skipIf(!process.env.DATABASE_URL)('T118 real client boundaries',()=>{
 afterAll(async()=>{await prisma.user.deleteMany({where:{tenantId:{in:ids}}});await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
 it('raw/unsafe/extends/array transaction rejected also inside callback',async()=>{
 const db=withTenant('fixture');
 for(const name of ['$queryRaw','$queryRawUnsafe','$executeRaw','$executeRawUnsafe','$extends','$parent'])expect(()=>Reflect.get(db,name)).toThrow();
 expect(()=>db.$transaction([] as never)).toThrow();
 await db.$transaction(async tx=>{expect(()=>Reflect.get(tx,'$queryRaw')).toThrow();});
 });
 it('model delegate parent cannot escape scoped wrapper',()=>{const db=withTenant('fixture');expect(()=>Reflect.get(db.customer,'$parent')).toThrow();});
 it('root Tenant/User queries remain tenant scoped; nested mutation has no side effect',async()=>{
 const a=await prisma.tenant.create({data:{slug:`scope-${crypto.randomUUID()}`,name:'A',city:'Girne'}}),b=await prisma.tenant.create({data:{slug:`scope-${crypto.randomUUID()}`,name:'B',city:'Girne'}});ids.push(a.id,b.id);
 await prisma.user.create({data:{tenantId:b.id,email:`scope-${crypto.randomUUID()}@example.test`,name:'B',role:'owner'}});
 const db=withTenant(a.id);expect((await db.tenant.findMany()).map(t=>t.id)).toEqual([a.id]);await expect(db.user.count()).rejects.toThrow('Desteklenmeyen');
 const c=await prisma.customer.create({data:{tenantId:b.id,name:'B',phone:'+905331110000'}});
 await expect(db.tenant.update({where:{id:a.id},data:{customers:{deleteMany:{id:c.id}}}})).rejects.toThrow('ilişki');
 expect(await prisma.customer.findUnique({where:{id:c.id}})).not.toBeNull();
 });
});
