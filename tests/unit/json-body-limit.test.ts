import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJson } from "@/lib/http";
const LIMIT=1048576;
const schema=z.object({value:z.string()});
function payload(bytes:number){const empty=JSON.stringify({value:""});return new TextEncoder().encode(JSON.stringify({value:"x".repeat(bytes-empty.length)}));}
async function status(req:Request){const r=await parseJson(req,schema);return r.ok?200:r.response.status;}
describe("bounded JSON body",()=>{
 it("rejects oversized declared length before consuming body",async()=>{const req=new Request('http://fixture',{method:'POST',body:'{}',headers:{'content-length':String(LIMIT+1)}});expect(await status(req)).toBe(413);expect(req.bodyUsed).toBe(false)});
 it.each([undefined,'2'])('enforces actual streamed bytes despite declared length %s',async length=>{const data=payload(LIMIT+1);let offset=0,cancelled=false;const body=new ReadableStream<Uint8Array>({pull(c){if(offset>=data.length){c.close();return}c.enqueue(data.subarray(offset,offset+65536));offset+=65536},cancel(){cancelled=true}});const req=new Request('http://fixture',{method:'POST',body,duplex:'half',headers:length?{'content-length':length}:{}} as RequestInit);expect(await status(req)).toBe(413);expect(cancelled).toBe(true)});
 it("preserves exact limit JSON and UTF8 split across chunks",async()=>{const exact=new Request('http://fixture',{method:'POST',body:payload(LIMIT)});expect(await status(exact)).toBe(200);const data=new TextEncoder().encode(JSON.stringify({value:'Kıbrıs şğ😊'}));let offset=0;const body=new ReadableStream<Uint8Array>({pull(c){if(offset===data.length)c.close();else c.enqueue(data.subarray(offset,++offset))}});expect(await parseJson(new Request('http://fixture',{method:'POST',body,duplex:'half'} as RequestInit),schema)).toEqual({ok:true,data:{value:'Kıbrıs şğ😊'}})});
 it("returns validation400 for a body already locked by another consumer",async()=>{const req=new Request('http://fixture',{method:'POST',body:'{"value":"x"}'});const reader=req.body!.getReader();try{expect(await status(req)).toBe(400)}finally{reader.releaseLock()}});
});
