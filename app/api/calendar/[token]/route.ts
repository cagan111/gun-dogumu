import { readCalendarFeed } from "@/lib/calendar-feed";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!(await rateLimit(`ical:${clientIp(req)}`, 60, 60000)).ok) return new Response(null, { status: 429, headers });
  try {
    const data = await readCalendarFeed((await ctx.params).token);
    if (data === null) return new Response(null, { status: 404, headers });
    return new Response(data, { headers: { ...headers, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="calendar.ics"' } });
  } catch { return new Response(null, { status: 503, headers }); }
}
