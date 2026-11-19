import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';
import {readCustomerCookie} from '@/lib/customer-session';
import {UnauthorizedError} from '@/lib/errors';
import {clientIp,enforceRateLimit,handle,parseJson} from '@/lib/http';
import {resolveTenant} from '@/lib/public';
import {MINUTE} from '@/lib/ratelimit';
import {consentSchema,getVerifiedConsent,updateVerifiedConsent} from '@/lib/customer-consent';
export const dynamic='force-dynamic';
type Params={params:Promise<{slug:string}>};
async function identity(req:NextRequest,p:Params){
 await enforceRateLimit(`consent:${clientIp(req)}`,30,MINUTE);
 const slug=(await p.params).slug,t=await resolveTenant(slug,{allowSuspended:true}),phone=readCustomerCookie(req,slug,t.id);
 if(!phone)throw new UnauthorizedError();return {tenantId:t.id,phone};
}
export function GET(req:NextRequest,p:Params){return handle(async()=>{const a=await identity(req,p);return NextResponse.json(await getVerifiedConsent(a.tenantId,a.phone))})}
export function PATCH(req:NextRequest,p:Params){return handle(async()=>{const a=await identity(req,p),b=await parseJson(req,consentSchema);if(!b.ok)return b.response;return NextResponse.json(await updateVerifiedConsent(a.tenantId,a.phone,b.data.marketingConsent))})}
