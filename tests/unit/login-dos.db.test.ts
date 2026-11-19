import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {prisma} from '@/lib/db';
import {PrismaClient} from '@prisma/client';
import {loginFailureKey,recordLoginResult,loginPairBlocked,LOGIN_FAILURE_WINDOW_MS} from '@/lib/login-failures';
import {authenticatePassword,hashPassword} from '@/lib/login';
try{process.loadEnvFile('.env')}catch{ /* optional env */ }
const keys=new Set<string>();
const run=(email:string,password:string,ip:string)=>{keys.add(loginFailureKey(email,ip));return authenticatePassword(email,password,ip)};
let id='',email='';const password='fixture-login-only';
describe.skipIf(!process.env.DATABASE_URL)('T145 password login DoS',()=>{
 beforeAll(async()=>{email=`login-${crypto.randomUUID()}@example.test`;id=(await prisma.user.create({data:{email,name:'Fixture',role:'superadmin',passwordHash:await hashPassword(password)}})).id});
 afterAll(async()=>{await prisma.loginFailure.deleteMany({where:{key:{in:[...keys]}}});await prisma.user.deleteMany({where:{id}})});
 it('distributed invalid guesses cannot lock the correct password from another IP',async()=>{for(let i=0;i<9;i++)expect(await run(email,'wrong',`fixture-attacker-${i}`)).toBeNull();expect(await run(email,password,'fixture-owner')).toMatchObject({id})});
 it('successful logins do not consume the email failure allowance',async()=>{const another=await prisma.user.create({data:{email:`other-${crypto.randomUUID()}@example.test`,name:'Fixture',role:'superadmin',passwordHash:await hashPassword(password)}});try{for(let i=0;i<10;i++)expect(await run(another.email,password,'fixture-success')).toMatchObject({id:another.id})}finally{await prisma.user.delete({where:{id:another.id}})}});
 it('pair limit persists across clients and leaves other pairs available',async()=>{
 const key=loginFailureKey(email,'fixture-persist');keys.add(key);const now=new Date();
 for(let i=0;i<8;i++)await recordLoginResult(key,false,new Date(+now+i),new Date(+now+i+1));
 const otherClient=new PrismaClient();try{expect((await otherClient.loginFailure.findUniqueOrThrow({where:{key}})).failedCount).toBe(8)}finally{await otherClient.$disconnect()}
 expect(await loginPairBlocked(key,new Date(+now+20))).toBe(true);expect(await loginPairBlocked(key,new Date(+now+LOGIN_FAILURE_WINDOW_MS+20))).toBe(false);
 expect(await run(email,password,'fixture-fresh-owner')).toMatchObject({id});
 });
 it('success resets its pair and rejects stale parallel failure writes',async()=>{
 const key=loginFailureKey(email,'fixture-reset');keys.add(key);const now=new Date();
 await recordLoginResult(key,false,new Date(+now-100),new Date(+now-90));
 await recordLoginResult(key,true,new Date(+now-80),now);
 await recordLoginResult(key,false,new Date(+now-50),new Date(+now+10));
 expect((await prisma.loginFailure.findUniqueOrThrow({where:{key}})).failedCount).toBe(0);
 await recordLoginResult(key,false,new Date(+now+20),new Date(+now+21));expect((await prisma.loginFailure.findUniqueOrThrow({where:{key}})).failedCount).toBe(1);
 });
 it('IP attempt budget still rejects excessive valid attempts',async()=>{for(let i=0;i<30;i++)expect(await run(email,password,'fixture-ip-budget')).toMatchObject({id});expect(await run(email,password,'fixture-ip-budget')).toBeNull()});

 it('malformed attempts also consume the IP budget without touching a user',async()=>{for(let i=0;i<30;i++)expect(await run('', '', 'fixture-malformed')).toBeNull();expect(await run(email,password,'fixture-malformed')).toBeNull()});

});
