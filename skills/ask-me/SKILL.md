---
name: ask-me
description: Kullanıcının sorusuna derinlemesine analiz edilmiş, çelişkisiz ve kaynaklı bir nihai cevap üretmek için kullan. Bu skill prompt-generator'ın gelişmiş bir versiyonudur; ancak çıktı olarak bir prompt değil, doğrudan soruya bir cevap üretir. Kullanıcı "ask-me", "derinlemesine cevapla", "bu soruyu analiz et", "çelişkileri gider ve cevapla" gibi açık ifadeler kullandığında MUTLAKA bu skill'i kullan. Ayrıca kullanıcı "bu konuda ne düşünüyorsun", "araştır ve söyle", "hangisi daha mantıklı", "kapsamlı/derinlemesine özetle", "bana en doğru cevabı bul" gibi dolaylı ifadelerle ya da karmaşık, çok parçalı, araştırma/analiz gerektiren, veya potansiyel olarak çelişkili bilgiler içeren bir soru sorduğunda da bu skill'i MUTLAKA tetikle — kullanıcı "ask-me" kelimesini hiç kullanmasa bile. Basit, tek cümlelik, doğrudan cevaplanabilir sorularda kullanma.
---

# ask-me

Bu skill, kullanıcının sorusunu prompt-generator tarzı bir sorgulama sürecinden geçirip, alt parçalara bölerek analiz eden, çelişkileri derinlemesine sorgulama ile gideren ve nihayetinde detaylı, kaynaklı, biçimlendirilmiş (markdown) bir cevap hem sohbette hem de indirilebilir/kopyalanabilir bir `.md` dosyası olarak üreten bir analiz sürecidir.

**Bu skill'in tek görevi soruyu cevaplamaktır.** Agent, subagent veya proje oluşturmaz; sadece analiz edip cevap verir.

Aşağıdaki round sırasını takip et — kullanıcı açıkça atlamanı istemedikçe round'ları atlamadan veya sırasını değiştirmeden ilerle.

## Round 1 — Serbest metinli keşif (bir soru → bir cevap)

**Amaç:** İsteği analiz etmek ve çevresel etkenleri (bağlam, ortam, amaç) tespit etmek.

Şu soruyla başla: **"Neyi öğrenmek/çözmek istiyorsun?"**

Bu round'da:
- **Asla seçenek veya buton sunma.** Sorular tamamen serbest metin ve konuşma tarzında olmalı (bu round'da seçenek tabanlı araçlar kullanılmaz).
- **Aynı anda sadece bir soru sor**, cevabı bekle, sonra bir sonraki soruyu sor. Arka arkaya birden fazla soru listeleme. Bu kural her koşulda geçerlidir — soru kısa da olsa uzun/detaylı da olsa, tek bir soru olarak sorulur.
- **Sorular varsayılan olarak kısa ve net olsun.** Kullanıcı bir konuyu detaylandırmanı istemedikçe soruları kısa tut. Kullanıcı "bunu biraz daha detaylandır" gibi bir istekte bulunursa, o tek soruyu daha uzun/açıklayıcı bir şekilde sorabilirsin — ama yine de tek bir soru olarak kalır, birden fazla soruya bölünmez.
- **Her sorunun tek bir odak noktası olsun.** Bir soru cümlesi içinde birden fazla konuyu birleştirme (örn. "bağlamı ve beklenen kapsamı anlatır mısın?" gibi iki farklı şeyi tek soruda sorma). Her soru yalnızca aşağıdaki alanlardan birine odaklansın; bir sonraki alana geçmeden önce o alanı netleştir.
- **Toplam soru sayısı sınırı:** Bu round'da en az 3, en fazla 10 soru sor (aşağıdaki asgari-3 istisnası hariç). 10 sorudan önce konu yeterince netleştiyse daha erken bitirebilirsin (asgari 3 şartıyla, istisna durumu hariç). İstisna: 10 soruya ulaşıldığında istek hâlâ netleşmediyse (belirsizlik, çelişki veya eksik bilgi devam ediyorsa), 10 sınırını aşıp sormaya devam edebilirsin — netlik önceliklidir.
- **Asgari 3 soru istisnası:** Kullanıcı ilk mesajında zaten aşağıdaki 4 alandan çoğunu kendiliğinden, detaylı biçimde açıklamışsa (bağlam, kapsam, kısıtlar vb.), asgari 3 soru şartı esner — yalnızca gerçekten belirsiz kalan alan(lar) için soru sor; hiçbir alan belirsiz kalmadıysa bu round'u 1-2 soruyla, hatta hiç soru sormadan bitirebilirsin.
- Kullanıcının ilk cevabına göre, aşağıdaki alanları tek tek netleştir — cevaplarında zaten karşılanan noktaları atla, hepsini sormak zorunda değilsin:
  1. Sorunun tam olarak ne olduğu (kullanıcı gerçekte neyi öğrenmek/çözmek istiyor)
  2. Bağlam (hangi amaçla soruyor, hangi ortam/durumla ilgili)
  3. Beklenen cevabın kapsamı (ne kadar detay, hangi açılardan ele alınmalı)
  4. Elindeki ek bilgi/kısıtlar (bildiği veya varsaydığı şeyler, hariç tutulması gereken şeyler)
- Bu round, ilerlemek için yeterli bilgi toplandığında sona erer (normalde asgari 3, azami 10 soru; asgari-3 istisnası veya azami-10 istisnası geçerliyse bu sayılar esner). Gereksiz yere uzatma.

## Round 2 — Çoklu seçimli netleştirme

**Amaç:** Kapsamı genişletmek ve çelişkili istekleri tespit etmek.

Round 1'de toplananlara dayanarak netleştirici sorular hazırla ve bunları **`ask_user_input_v0`** aracıyla `multi_select` tipinde sor (kullanıcı birden fazla seçeneği işaretleyebilmeli).

- Sorular Round 1'in cevaplarından doğmalı — örn. kullanıcı "yatırım kararı için karşılaştırma istiyorum" dediyse, bu round "Hangi kriterlere göre karşılaştırma yapılsın? (risk / getiri / likidite / vergi...)" gibi somut, çoklu seçilebilir bir soru sorabilir.
- Amaç: Round 1'in geniş cevaplarını somut analiz kararlarına dönüştürmek (hangi alt başlıklar ele alınacak, hangi varsayımlardan kaçınılacak vb.), aynı zamanda kapsamı gerektiği kadar genişletmek.
- Kullanıcının verdiği çoklu seçimler arasında (veya Round 1 cevaplarıyla) birbiriyle çelişen ya da birlikte anlamsız olan kombinasyonlar varsa bunları not al — bu çelişkiler Round 3'te giderilecek.
- Araç, çağrı başına en fazla 3 soruya izin verir; gerekirse ek çağrılar yap.

## Round 3 — Çelişki kontrolü (tekli seçim)

**Amaç:** Tespit edilen çelişkileri gidermek.

Round 2'de not edilen çelişkileri, ve Round 1-2 cevaplarını birlikte tekrar gözden geçirerek gözden kaçmış olabilecek başka çelişki veya anlamsız kombinasyon olup olmadığını kontrol et.

- Bir çelişki varsa, her çelişki için **`ask_user_input_v0`** aracını `single_select` tipinde kullan, kullanıcının net, birbirini dışlayan seçenekler arasından seçim yapabileceği şekilde sun.
- Çelişki yoksa bu round'u atla ve özet kısmına geçmeden önce kısaca "Cevaplarında bir çelişki tespit etmedim" de.
- Bu round her zaman tekli seçim olmalı — kullanıcı burada net bir tercih yapmalı, çoklu seçim yok.
- **Bu kontrolü asla sessizce atlama.** Çelişki bulunsun ya da bulunmasın, özet kısmına geçmeden önce kullanıcıya en az bir cümlelik kontrol sonucunu mutlaka bildir (ya "şu çelişki(ler) tespit edildi, seçim yap" ya da "bir çelişki tespit etmedim").

## Kaynak tercihleri (Round 3 sonrası)

**Amaç:** Analiz sürecinde kullanılacak kaynak türünü ve arama derinliğini belirlemek.

Round 3 tamamlandıktan sonra, özet adımına geçmeden önce aşağıdaki iki soruyu **`ask_user_input_v0`** aracıyla `single_select` tipinde sor (yalnızca bir seçenek işaretlenebilir, ikisi de zorunludur):

1. **Kaynak türü** — "Hangi tür kaynaklar kullanılsın?"
   - Resmi kaynaklar
   - Resmi kaynaklar + güvenilir community/teknik blog
   - Genel kaynaklar
2. **Arama derinliği** — "Kaynak araştırması ne kadar derin olsun?"
   - Hızlı (1-3 kaynak/arama)
   - Orta (4-8 kaynak/arama)
   - Derinlemesine (8-20+ kaynak/arama, kapsamlı)

Bu iki soru aynı `ask_user_input_v0` çağrısında birlikte sorulabilir (araç çağrı başına en fazla 3 soruya izin verir). Bu iki tercih, hemen ardından gelen özete dahil edilir ve kullanıcı özeti onaylarken bunları da değiştirebilir.

## Özet ve onay

Üç round ve Kaynak tercihleri adımı tamamlandıktan sonra:

1. Toplanan her kararın kısa, maddeler halinde bir özetini göster (asıl soru, bağlam, kapsam, kısıtlar, kaynak türü ve arama derinliği tercihleri dahil — Round 2/3 ve Kaynak tercihleri adımında netleşenler dahil).
2. Kullanıcıya sor: **"Bu özeti gözden geçirebilir misin? Değiştirmek veya eklemek istediğin bir şey var mı?"**
3. Kullanıcı bir maddede düzeltme isterse, yeni değeri olduğu gibi kabul etme — o madde üzerinde küçük bir derinlemesine sorgulama yap:
   - Tam olarak neyin, neden değişmesi gerektiğini anlamak için bir veya daha fazla serbest metin takip sorusu sor (Round 1 tarzında — aynı anda tek soru, seçenek/buton yok).
   - Değişikliğin somut alt seçenekleri varsa (örn. kapsamın yeniden ele alınması, kriterlerin değişmesi), duruma uygun şekilde `ask_user_input_v0` ile multi_select veya single_select bir soru sorarak netleştir (Round 2/3 tarzında).
   - Madde tam netleştiğinde güncelle (ve diğer özet maddeleriyle yeni çelişki olup olmadığını tekrar kontrol et), tam özeti tekrar göster.
   - Kullanıcı tüm özetten memnun olana kadar, istenen her düzeltme için bu derinlemesine inceleme adımını tekrarla.
4. Kullanıcı özeti onayladıktan sonra, ayrı ve açık bir onay iste: **"Bu özete göre analiz edip cevap üretmeye başlayayım mı?"**
5. Sadece kullanıcı net bir şekilde onayladıktan sonra ilerle (evet/onaylıyorum/başla vb.). Bu onaydan önce analize başlama.

## Analiz süreci (iç işleyiş — kullanıcıya gösterilmez)

Onaydan sonra, aşağıdaki iç analiz sürecini uygula. Bu süreç kullanıcıya ham haliyle gösterilmez; sadece nihai cevap paylaşılır.

1. **Parçalara ayırma:** Onaylanan soruyu/problemi, bağımsız olarak analiz edilebilecek alt sorulara/alt parçalara böl. Karmaşıklığa göre adım adım akıl yürütme kullanarak hangi alt parçaların gerekli olduğuna karar ver.
2. **Alt parça analizi:** Her alt parçayı ayrı ayrı analiz et ve cevapla. Gerekirse XML etiketleriyle (`<subquestion>`, `<analysis>`, `<finding>` vb.) iç yapılandırma kullanarak süreci düzenli tut. Somut, doğrulanabilir iddialar için onaylanan özette yer alan **kaynak türü** ve **arama derinliği** tercihine uygun şekilde güncel kaynak arayarak (web araması) destekle:
   - Kaynak türü "Resmi kaynaklar" seçildiyse yalnızca resmi/kurumsal/birincil kaynaklara öncelik ver; "Resmi kaynaklar + güvenilir community/teknik blog" seçildiyse resmi kaynaklara öncelik ver ama tanınmış, güvenilir topluluk/teknik blog kaynaklarını da destekleyici olarak kullanabilirsin; "Genel kaynaklar" seçildiyse bu kısıtlama olmadan ara.
   - Arama derinliği "Hızlı" ise 1-3 arama ile yetin; "Orta" ise 4-8 arama yap; "Derinlemesine" seçildiyse 8-20+ aramayla çok sayıda kaynağı tarayarak kapsamlı araştır.
   - Site/kaynak araştırması sırasında konuyla doğrudan ilgili, temsili örnek görseller (web_search veya image_search sonuçlarında) karşına çıkarsa, bunları not al — nihai cevapta ilgili bölüme eklenecek.
3. **Çelişki tespiti:** Alt parça cevapları arasında çelişki olup olmadığını kontrol et (örn. bir alt cevabın vardığı sonuç başka bir alt cevabın öncülüyle çelişiyor mu).
4. **Derinlemesine sorgulama ile giderme:** Çelişki tespit edilirse, çelişkili noktaları tekrar sorgula (ek analiz, ek kaynak arama veya gerekirse kullanıcıya netleştirici bir soru sorarak) ve çelişkiyi gider. Birden fazla çelişki tespit edildiyse her çelişkiyi ayrı ayrı ele al ve her biri için bu adımı en fazla **3 tur** tekrarla (bir çelişkinin 3 turu, diğerinin sınırını etkilemez). Bir çelişki için 3 turun sonunda hâlâ giderilemediyse, o çelişkiye özel olarak iç analiz sürecini durdur ve kullanıcıya şunu sor: **"Şu noktada hâlâ bir çelişki var: [çelişkinin kısa özeti]. Nasıl ilerleyelim?"** — kullanıcının yönlendirmesine göre devam et.
5. **Birleştirme:** Çelişkisi giderilmiş, doğrulanmış alt cevapları tek, tutarlı bir nihai cevapta birleştir.

## Nihai cevap

Nihai cevabı kullanıcıya şu kurallarla sun:

- **Cevap tamamen biçimlendirilmiş markdown olsun.** Başlıklar (`##`, `###`), madde işaretli/numaralı listeler ve gerektiğinde tablo serbestçe kullanılır. Ana metin içinde markdown (kalın, italik, link, kod bloğu vb.) kullanılabilir.
- **Yapıyı içeriğe göre kur.** Cevabı, sorunun alt parçalarına karşılık gelen başlıklar altında organize et (örn. her alt soru/analiz konusu kendi başlığını alsın). Karşılaştırma, kriter, sayısal veri gibi çok boyutlu bilgi varsa tablo kullan; sıralı adım veya liste gerektiren noktalarda madde işareti/numaralandırma kullan.
- **Görsel varsa ilgili başlığın altında/satırında göster.** Kaynak araştırması (web_search veya image_search) sırasında konuyla doğrudan ilgili bir görsele rastlanırsa, bunu ayrı bir bölüme atma — hangi başlık/bölüm veya cümleyle ilgiliyse tam onun altına ya da hemen yanındaki satıra, markdown resim sözdizimiyle (`![açıklama](url)`) yerleştir.
- Görsel bulunamadıysa veya konuyla doğrudan ilgili/faydalı değilse görsel eklemek zorunlu değildir.
- **Detaylı olsun.** Yüzeysel geçme; sorunun gerektirdiği derinlikte ele al.
- **Varsayımlara dayanmasın.** Emin olunmayan noktalarda bunu açıkça belirt; boşlukları varsayımla doldurma.
- **Kaynak/referans zorunludur.** Mümkün olduğunda gerçek, güncel kaynaklara atıfta bulun (web araması kullanarak). Bir iddia için güvenilir kaynak bulunamıyorsa, bunu uydurma — "bu konuda doğrulanabilir bir kaynak bulunamadı" şeklinde açıkça belirt.
- Telif hakkı kısıtlarına uy: kaynaklardan alıntı yaparken kendi cümlelerinle özetle, doğrudan uzun alıntı yapma.
- **Cevap ayrıca dosya olarak da üretilmelidir.** Yukarıdaki kurallara göre hazırlanan nihai cevabın tamamını bir `.md` dosyası olarak oluştur (`create_file`) ve kullanıcıya sun (`present_files`) — böylece kullanıcı cevabı indirebilir veya kolayca kopyalayabilir. Dosyanın içeriği sohbette gösterilen metinle birebir aynı olmalı; sohbette ayrıca kısa bir özet/giriş cümlesi verip ardından dosyayı sunabilirsin, ama nihai cevabın tam metni mutlaka dosyada da bulunmalı.

<constraints>
- Round sırasını değiştirme veya atlama (kullanıcı açıkça istemedikçe).
- Round 1'de asla seçenek/buton sunma; ask_user_input_v0 Round 2, Round 3, Kaynak tercihleri adımı ve Özet'teki düzeltme döngüsünde kullanılabilir — Round 1'de asla.
- Round 1'de asgari 3 soru şartı yalnızca kullanıcı ilk mesajında ilgili alanları zaten detaylıca açıklamışsa esner; aksi halde asgari 3 soru kuralı geçerlidir.
- Round 2'de kaynak türü ve arama derinliği soruları sorulmaz; bu iki soru Round 3 tamamlandıktan sonra, özetten önce ayrı bir adımda (single_select) sorulur ve asla atlanmaz.
- Round 3 her zaman tekli seçim (single_select) olmalı ve sonucu (çelişki bulunsun ya da bulunmasın) her zaman en az bir cümleyle kullanıcıya bildir; bu adımı asla sessizce atlama.
- Özet onaylanmadan ve ayrı bir "başlayayım mı?" onayı alınmadan analiz sürecine başlama.
- Analiz sürecindeki çelişki giderme döngüsü en fazla 3 turla sınırlıdır; 3 turdan sonra hâlâ çelişki varsa kullanıcıya sorulur, sessizce devam edilmez.
- Kaynak araması, onaylanan özette yer alan kaynak türü ve arama derinliği tercihine göre yapılır (Kaynak tercihleri adımındaki ilk cevaba değil, özete referans ver — kullanıcı özet aşamasında bu tercihleri değiştirmiş olabilir).
- Nihai cevap tamamen biçimlendirilmiş markdown olmalı: başlıklar, madde işaretleri/numaralandırma serbest, gerektiğinde tablo kullanılır. Görsel varsa ilgili başlığın altına/satırına yerleştirilir, ayrı bir bölüme atılmaz.
- Nihai cevap yalnızca sohbette gösterilmez; aynı zamanda bir `.md` dosyası olarak oluşturulup (`create_file`) kullanıcıya sunulur (`present_files`) — kullanıcı indirebilsin/kopyalayabilsin diye. Bu adım asla atlanmaz.
- Kaynaksız, uydurma iddialarda bulunma; kaynak yoksa bunu açıkça söyle.
- Bu skill sadece soru cevaplar; agent, subagent veya proje oluşturmaz.
</constraints>
