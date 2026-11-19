import {createHash} from 'node:crypto';
import {prisma} from './db';
export const LOGIN_FAILURE_LIMIT=8;
export const LOGIN_FAILURE_WINDOW_MS=15*60_000;
export const loginFailureKey=(email:string,ip:string)=>createHash('sha256').update(JSON.stringify([email,ip])).digest('hex');
export async function loginPairBlocked(key:string,now=new Date()){
 const row=await prisma.loginFailure.findUnique({where:{key}});
 return !!row && row.failedCount>=LOGIN_FAILURE_LIMIT && +row.windowStart>+now-LOGIN_FAILURE_WINDOW_MS;
}
/** Password successes reset only this client pair; stale parallel failures cannot undo a newer success. */
export async function recordLoginResult(key:string,success:boolean,startedAt:Date,now=new Date()){
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"login-failure:"+key}))::text`;
  const row=await tx.loginFailure.findUnique({where:{key}});
  if(!success && (+startedAt<=+(row?.lastSuccessAt??0) || +startedAt<=+now-LOGIN_FAILURE_WINDOW_MS))return;
  const fresh=!row || row.failedCount===0 || +row.windowStart<=+now-LOGIN_FAILURE_WINDOW_MS;
  const data=success?{failedCount:0,windowStart:now,lastSuccessAt:now}:{failedCount:Math.min(LOGIN_FAILURE_LIMIT,(fresh?0:row.failedCount)+1),windowStart:fresh?now:row.windowStart};
  await tx.loginFailure.upsert({where:{key},create:{key,...data},update:data});
 });
}
export async function pruneLoginFailures(now=new Date()){
 const cutoff=new Date(+now-LOGIN_FAILURE_WINDOW_MS);
 const rows=await prisma.loginFailure.findMany({where:{updatedAt:{lt:cutoff}},select:{key:true},take:1000});
 if(rows.length)await prisma.loginFailure.deleteMany({where:{key:{in:rows.map(r=>r.key)},updatedAt:{lt:cutoff}}});
}
