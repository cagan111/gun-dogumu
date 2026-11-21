# Tenant istemcisinin desteklediği sınır

`withTenant(id)` üst düzey Prisma model işlemleri için sunucu içi bir sınırdır. PostgreSQL RLS veya genel JavaScript sandbox değildir. Kimlik doğrulama/yetkilendirme ayrıca API katmanında uygulanır.

- Tenant'a ait modellerin where/create alanları bağlı tenant ile kapsanır. Tenant kökü `id`, AuditLog `tenantId` ile kapsanır.
- Bilinmeyen model/işlem; LoginToken/PlanPrice gibi global modellere erişim; User yazmaları; AuditLog değiştirme/silme; nested relation yazmaları; tenant taşıma açıkça reddedilir. Desteklenmeyen global ilişkilere include/select ile geçiş de reddedilir.
- Üst düzey `updateManyAndReturn` kapsamlıdır. Transaction yalnız callback biçiminde desteklenir; callback aynı sınırı korur.
- Scoped istemcide raw/unsafe SQL, istemci genişletme, özel iç alanlar ve delegate `$parent` erişimi desteklenmez.

İlişkiler için mevcut servisler tenant kapsamından ilgili scalar FK kimliklerini doğrular ve ayrı model işlemleri kullanır. Veri modelinin bütün ilişkileri henüz composite tenant FK kullanmaz; bu yama FK veya RLS garantisi vermez. Normal ilişki okumaları korunur.

Gerekli kilit sorguları `lib/db.ts` içindeki sabit amaçlı helper'lardadır. Sorgu metni kabul etmezler; tenant kilitleri bağlı kimliği kontrol eder. Eski advisory anahtarları korunur. T142 telefon/gün güvenlik toplamı ve kilidi bilerek platform kapsamlıdır; API müşteriye bu toplamı döndürmez. Yetkili auth/admin/sistem işleri global `prisma` kullanabilir; bu ayrıcalık kullanıcı sorgularına taşınmaz.

Doğrulama: T118 ilk sekiz saf test eski kaynakta başarısız; runtime DB testleri raw/unsafe, transaction, delegate parent, global model kapsamı, nested mutation ve bağlı kilit uyuşmazlığını kapsar. Son çalıştırma sonuçları REVIEW/CODEX_CHECKPOINT ve PR tesliminde kayıtlıdır.

Son Luna incelemesi: User varsayılan okuması ve Staff.user include passwordHash taşıyabileceğinden User scoped istemciden tamamen kaldırıldı; auth/admin global prisma kullanır. User/nested-user erişimi reddedilir. Subscription sistem satır kilidi de sabit lockTenantRow helperına taşındı.

T124b2b1 lockMoveResources yalnız sabit Service/Staff SELECT FOR UPDATE kullanır; tenantId+id filtreleri ve raw(client,tenantId) bağlı-kimlik kontrolü korunur. Serbest sorgu/metin veya yeni global kapsam açılmaz.
