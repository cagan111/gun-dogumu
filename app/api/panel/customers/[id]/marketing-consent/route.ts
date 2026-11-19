import {panelRoute} from '@/lib/panel-auth';
import {parseJson} from '@/lib/http';
import {optOutSchema,optOutCustomer} from '@/lib/customer-consent';
export const dynamic='force-dynamic';
export const PATCH=panelRoute(async(ctx,req,p)=>{const b=await parseJson(req,optOutSchema);if(!b.ok)return b.response;return optOutCustomer(ctx,p.id as string)},{allowSuspendedWrite:true});
