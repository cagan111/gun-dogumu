# Paket üretme kontrol aracı — 13 Kasım2026 İstanbul

Bağımsız araç; önceki iki uygulama teslimi yeniden uygulanmadı. tools/build-standalone.cjs açık --input/--output ister, mevcut yayın dosyasına/index'e testte dokunulmadı. Ağ/API/deploy/refpush yok. Yerel göreli classic scriptleri sıra korunarak inline eder; büyük/küçükharf ve tireli dosyalar atlanmaz. Inline scriptleri korur, </script kaçışını harf büyüklüğü ve JSstringdeğeri korunarak yapar. Missing/duplicate/outsidepath/module/async/defer/quotedolmayan src için fail; yazma bütün dosyalar okunduktan sonra. Kaynakindex/JS üzerineçıktıreddedilir. Bu kontrollü oyunHTML'i için küçük bundler'dır, genelHTML parser veya assetpackager değildir. GLB/JPG/wasm gibi resources ayrıca doğru göreliyolda yayınpaketinde bulunmalı; araç onları kopyalamaz.

node --test tests/bundle.test.cjs =>3/3 Node: caps+hyphen+sıra+inline+mixedcaseendtag JSdeğer; missing/duplicate/path/module/output koruma; gerçek15script(GLTFLoaderdahil) ve üretilenhergövdeV8parse. İlkescape sabitlowercase yaptığıiçinmixedcase semantictestfailoldu, m.slice korunarakdüzeltildi. Gerçekoutput /tmp/son-ates-bundle-test.html,1,628,773byte/15script; gerçekson-ates.html/index byte'larıdeğişmedi. Oyun içi WebGL/browsertesti bu araç turunda yapılmadı; syntax/packagingtestidir.

Kullanım:
node tools/build-standalone.cjs --input 'gun-dogumu-vercel-duzeltildi (1)/oyun/index.html' --output /tmp/son-ates-check.html

Araç sonra güncelindex'e eklenmişdeniz.js/varlik.js'i de otomatikalır; bu tabandakiindexhenüz15script olduğundanoikiöncekipaketuygulanmışsayılmadı. Claude kendi bundle sahibi olarakinceleyipistersekullanabilir, yayın komutu yok. Codex kaynakbranchcodex/bundle-check-20261113 taban187b95c. Patch yalnızyeniaraç/test/rapor, eskiPRmergeyok. EXTRACTONLYteslim ağacını merge/cherry-picketme.
