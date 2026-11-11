# Mega Radio sohbet davranış sözleşmesi

- Kullanıcıyla Türkçe iletişim kur. Birebir ve grup sohbeti aynı mesaj davranışlarını
  kullanır; bir ekranda tamamlanan işlevi diğerinde kullanıcıya tekrar söyletme.
- Menü, cevaplama, kopyalama, sabitleme, çoklu seçim/silme, son mesaja dönme oku
  ve kaydırma davranışlarında ortak bileşenleri kullan; ayrı tasarım üretme.
- Gerçek servis, üyelik/yetki kontrolü, socket ve önizleme verilerini birlikte güncelle.
- Herkesten sil yalnızca kullanıcının kendi mesajları için sunulur. Benden sil
  yalnızca o kullanıcının görünürlüğünü değiştirir.
- Asıl talimat ve iş akışı: /Users/sahinyogurtcu/Documents/ChatGPT/Megaradio/AGENTS.md
  ve aynı projenin docs/DESIGN_WORKFLOW.md dosyası.

- Sohbette çalan radyo kartı görünürken mini player gösterilmez. Kart görüş
  alanından çıkınca mini player görünür; karta dönünce gizlenir. Aynı ortak
  davranışı birebir ve grup sohbetinde koru. Serbest taşıma konumu saklanır.
- Sohbet mini player zemini ve ince çerçevesi mevcut logo baskın renk sistemiyle
  renklendirilir. Taşıma eğitimi yalnızca mini player gerektiğinde gösterilir.

- Sohbet keşfinde varsayılan/eksik/yüklenmeyen logoyu ve canlı decoder
  kontrolünü geçmeyen yayını sonuç olarak paylaşma. Kontrol tüm kataloğa
  uygulanmaz: en fazla iki sessiz ön aday, kısa geçerli sonuç önbelleği ve
  geçici bozuk-yayın karantinası kullanılır. Ana oynatıcı gerçekten çalmadan
  paylaşımı açma; iptal/arka plan durumunda kontrolleri temizle.

- Konuşma listesinde birebir ve grup satırları aynı sola kaydırma bileşenini
  kullanır: Diğer + Arşivle/Çıkar. Yatay hareketin sonundaki tıklama sohbeti
  açmaz; dikey liste kaydırması korunur. Diğer menüsü basılı tutmayla da açılır.
- Arşiv, sessize alma ve okunmadı işareti kullanıcıya özeldir. Temizle ve sil
  başka katılımcıların geçmişini değiştirmez. Grupta sohbeti silmeden önce
  ayrılmak gerekir; ayrıldıktan sonraki mesajlara erişim verilmez. Gerçek
  hesaplarda kalıcılık chat_inbox_state üzerinden sunucudadır; önizleme
  aynı davranışı ayrı kullanıcı anahtarıyla yerelde saklar.

- Sabitlenen içerik radyo ise ortak sabit bant play/pause ve canlı dinleyici
  fotoğraf şeridi kullanır; metin sabitlemesi aynı kompakt görünümü korur.
  Kart ve bant aynı oynatma kancasını kullanır. Dinleyiciler aynı stationId,
  gerçek playing durumu ve süresi dolmamış sohbet/grup presence verisiyle
  belirlenir; demo dinleyiciler gerçek sohbete eklenmez. Sabit radyo kontrolü
  görünürken aynı radyonun mini player'ını ayrıca gösterme.

- Sohbet mini player'ı duraklatılmış eski bir istasyonla girişte açılmaz.
  Çalan radyoyla giriş veya ziyaret sırasında gerçek playing durumu gerekir.
  Bu ziyaret içinde pause edilirse devam kontrolü kalır; sohbet/istasyon
  değişimi, blur, idle ve error eski görünürlük hakkını sıfırlar. Ortak
  useChatMiniPlayerEligibility birebir ve grupta zorunludur.

## İşlem geri bildirimi tasarım sözleşmesi

- Başarı/hata gibi kısa işlem bildirimlerinde onaylanan ProfilePhotoFeedback
  bileşenini kullan veya ortaklaştır. Her ekran için farklı toast/balon üretme.
- Mega kutusu: #000000 zemin, 1px #292929 çerçeve, radius6, Ubuntu-Medium15/20,
  ortalı metin;302px genişlik/max90%, düğmesiz. Sayfa akışı dışında, tab/mini
  player dock'unun üstünde16px boşlukla durur; premium bandını örtmez, içerik
  kaydırmaz. Başarı7s/hata9s, erişilebilirlik gereğinde daha uzun.
- Kaynak: src/components/ProfilePhotoFeedback.tsx; Figma1711:10380 kutu ailesi.
  Native hata/onay gerektiren işlemleri bu geçici bildirimle karıştırma.

- Konum izni başlangıçta istenmez. fetchLocation varsayılanı sessiz izin
  kontrolüdür; requestPermission:true yalnızca kullanıcının konum eylemiyle
  gönderilir. İzin/konum hatası ayrılır, reddedilince ülke radyoları çalışır;
  verilmiş izin gereksiz yeniden sorulmaz. Ortak işlem bildirimi stili korunur.

- Telefon bildirim anahtarı pushEnabled içindir; uygulama içi zil listesini
  kapatmaz. usePushPreferences kancasını ve hesap bazlı notificationPreferences
  cache'ini kullan. OS izni ayrı kontrol edilir; başlangıçta sessiz kayıt,
  kullanıcı opt-in eyleminde izin, kayıtta optimistic+rollback/owner guard korunur.
  Uygulama içi bildirim sorgularını hesabın query anahtarıyla ve push'tan bağımsız
  yenile. Başka hesapların global cihaz tercihini kopyalama.

- Uyku zamanlayıcısı tek ortak SleepTimerModal içinde seçim/sayaç ve kompakt
  üst oynatıcı kullanır. Ayrı iki Modal veya tam player üstüne kayan ikinci
  player üretme. Kapat timer'ı korur, Durdur iptal eder, Başlat sonrası ON
  görünür. Çark başlangıcı gerçek seçime hizalanır; sayaç bitiş zamanı
  üzerinden hesaplanır, gecikmiş tick süreyi uzatmaz.

- Kullanıcının 2026-11-10 talebi: login akışında (login/signup/forgot-password)
  hata mesajları login ekranındaki üst kutuya sadık kalır. Ortak AuthErrorNotice
  kullanılır; bu akışta alttaki ProfilePhotoFeedback kullanılmaz.

- Tüm yükleme göstergelerinde ortak `src/components/MegaLoadingIndicator.tsx`
  kullanılır; ayrı native/web spinner veya eski mor tema göstergesi ekleme.
  Halka gereken sayfa yüklemesi44px, kontrol içi24px; Mega#FF4199, dolu düğmede beyaz.
  Aynı SVG halka/800ms dönüş, reduced-motion ve arka plan durdurma korunur.

- Radyo aramasında öncelik eşleşme doğruluğudur: birebir ad, normalize edilmiş
  aynı ad (boşluk/tire/harf farkı), ad içindeki yakın eşleşmeler, şehir/tür
  eşleşmeleri. Oy DESC yalnız aynı eşleşme düzeyinde kullanılır; yüksek oy
  tam adı geriye atamaz. Ortak stationSearch yardımcıları kullanılır.

- Radyo aramalarında ad/ülke/state/city/ülke kodları/tür alanlarının eşleşmesi
  `stationSearch.ts` içinde tanımlanır. Home, katalog/tür detayı, Favoriler,
  sohbet seçicisi ve CarPlay bu yardımcıları kullanır. Yerel listelerde ayrı
  contains/synonym kuralları yazma. Cache sürümü STATION_SEARCH_VERSION ortak
  sabitinden alınır; davranış değişiminde her sayfayı ayrı elle güncelleme.
- Kendi profili ve başkasının profilini paylaşma aynı ProfileShareSheet'i
  kullanır. Başkasının profili `profile` prop'uyla verilir; görüntülenen hedef
  ve oturum kimliği değişince eski paylaşım içeriği geçersizdir. Başka modal
  üretme; gerçek herkese açıklık kontrolünü ve native share kapanışını koru.

- Tam kategori adı/slug araması ortak stationSearch tür niyetini kullanır. Pop,
  klasik gibi türlerde ülke kapsamını koru, oy DESC; aynı oyda gerçek logo
  metadatasını tercih et. Radyo adı aramasının tam eşleşme önceliğini bozma.
  Aramada görsel HEAD/probe yapma. Varsayılan Mega URL ve yerel fallback
  görselleri gerçek logo sayılmaz. Fallback tek kaynaktır: Figma2269:8153
  gri SVG, native CarPlay için aynı parçanın PNG çıktısı.

## Ortak içerik yüklemesi

- Veri bekleyen yerleşimler `MegaLoadingState` kullanır: grid, tür satırı, radyo
  listesi, kullanıcı, konuşma, bildirim, tercih/ülke, istatistik ve metin.
  Header/dock sabittir; eski veri varken arka plan yenilemesi içeriği gizlemez.
- Siluetler `Skeleton` temelini, tüm halkalar `MegaLoadingIndicator` kullanır.
  Renk/ölçü/yerleşim için her ekrana ayrı placeholder veya spinner üretme.
  `useSharedLoadingMotion` iki ortak saat ve tek hareket/uygulama durumu
  aboneliğini yönetir. Azaltılmış hareket ve arka plan durdurması korunur.
- Native aşağı çekme yenilemesi `MegaRefreshControl` kullanır; platformun
  hareketi/offset'i korunur, iOS/Android rengi #FF4199 ile aynıdır.
- Profil resmi ve radyo görseli byte yüklemelerinde aynı nötr görsel temeli
  kullanılır; yerel fallback hazırsa sahte bekleme/halka gösterilmez.
- Yerel kontrol: `loading-preview` yalnız development web proxy'de açıktır;
  canlı uygulamada Redirect verir. Kontrol listesinin final işaretlerini
  kullanıcı koyar.

- Ülke seçicide görünen ad uygulama dilinden (`countryLocalization`) gelir; arama
  desteklenen tüm dillerin ülke adlarını ve ISO kodunu birlikte eşleştirir.
  Görüntü çevirisini API/persist parametresine yazma: canonical name + code korunur.
  Home ve katalog seçicisi ortak CountrySelectorModal kullanır.

- Katalog/tür detayı ve bağlantı listelerinin arama odağı `useMegaSearchFocus`
  kaynağından gelir: dış kutuda 1px Mega#FF4199, iç alanda tarayıcı halkası yok.
  Katalog merceği Home `home/search.svg` 24px; temizleme `favorites/clear.svg` 24px.

- Tür detayı ve Tüm İstasyonlar filtrelerinde sıralama sunucuda sayfalama öncesi
  uygulanır; Popüler=oy DESC, eşit oyda click_count DESC, sonra logo/id.
  Sayfa içinde yeniden sıralama yapma. Aramada tam ad/eşleşme önceliğini koru.
