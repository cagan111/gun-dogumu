import {expect,it} from "vitest";
import {effectiveServiceTerms} from "@/lib/service-terms";
const service={id:"svc",tenantId:"a",durationMin:30,bufferMin:10,priceTry:"125.50"};
const staff={id:"staff",tenantId:"a"};
const link={tenantId:"a",serviceId:"svc",staffId:"staff",durationMinOverride:null,priceTryOverride:null};
it("inherits each salon default independently, preserves zero price, and never mutates sources",()=>{
 expect(effectiveServiceTerms(service,staff,link)).toEqual({durationMin:30,bufferMin:10,priceTry:"125.50"});
 expect(effectiveServiceTerms(service,staff,{...link,priceTryOverride:"0"})).toEqual({durationMin:30,bufferMin:10,priceTry:"0.00"});
 expect(effectiveServiceTerms(service,staff,{...link,durationMinOverride:45})).toEqual({durationMin:45,bufferMin:10,priceTry:"125.50"});
 expect(service.durationMin).toBe(30);expect(link.durationMinOverride).toBeNull();
});
it("rejects foreign tenant/staff/service links rather than using another person's quote",()=>{
 for(const bad of [{...link,tenantId:"b"},{...link,staffId:"other"},{...link,serviceId:"other"}])expect(()=>effectiveServiceTerms(service,staff,bad)).toThrow();
 expect(()=>effectiveServiceTerms(service,{...staff,tenantId:"b"},link)).toThrow();
});
it("rejects corrupt durations/prices without rounding money or silently falling back",()=>{
 for(const durationMinOverride of [0,4,601,NaN,10.5])expect(()=>effectiveServiceTerms(service,staff,{...link,durationMinOverride})).toThrow();
 for(const priceTryOverride of ["-1","100000.01","1.001","NaN","1e3"])expect(()=>effectiveServiceTerms(service,staff,{...link,priceTryOverride})).toThrow();
 expect(effectiveServiceTerms(service,staff,{...link,priceTryOverride:"99999.99"}).priceTry).toBe("99999.99");
});
