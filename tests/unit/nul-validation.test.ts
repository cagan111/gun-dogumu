import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseWith } from "@/lib/http";
const nul=String.fromCharCode(0);
describe("NUL validation boundary",()=>{
 it.each([{name:`a${nul}b`},{nested:[{name:`a${nul}b`}]},{[`key${nul}`]:'value'}])('rejects nested NUL input before schema execution',input=>{const r=parseWith(z.unknown(),input);expect(r.ok).toBe(false);if(!r.ok)expect(r.response.status).toBe(400)});
 it('rejects NUL created by a schema transform',()=>{expect(parseWith(z.string().transform(()=>nul),'encoded').ok).toBe(false)});
 it('preserves literal escape text and ordinary Unicode',()=>{const input={name:'Kıbrıs şğ😊',literal:'\\u0000'};expect(parseWith(z.unknown(),input)).toEqual({ok:true,data:input})});
});
