import {describe,it,expect} from 'vitest';
import {safeNext} from '@/lib/safe-next';
describe('T143 same-origin login redirects',()=>{
 it.each(['/\t/evil.example','/\n/evil.example','/\r/evil.example','//evil.example','/\\evil.example','https://evil.example','javascript:alert(1)','/\u0000x','/a\u007fb'])('rejects unsafe path %j',path=>{expect(safeNext(path)).toBeNull()});
 it.each(['/panel','/admin','/panel?view=week#today','/salon/şık','/panel?q=a%20b'])('preserves local path %s',path=>{expect(safeNext(path)).toBe(path);expect(new URL(safeNext(path)!, 'https://local.example').origin).toBe('https://local.example')});
 it('handles empty and array parameters',()=>{expect(safeNext(null)).toBeNull();expect(safeNext([])).toBeNull();expect(safeNext(['/panel','//evil.example'])).toBe('/panel')});
});
