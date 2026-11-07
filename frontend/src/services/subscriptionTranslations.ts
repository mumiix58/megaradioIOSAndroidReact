// Local fallbacks keep account status readable before remote translations load.
const rows: Record<string, string[]> = {
  en: ['Premium Active', 'Ad-free Active', 'Manage subscription', 'Your subscription is active. No new purchase is needed.', 'Restore purchases'],
  tr: ['Premium aktif', 'Reklamsız üyelik aktif', 'Aboneliği yönet', 'Aboneliğiniz aktif. Yeniden satın almanız gerekmiyor.', 'Satın alımları geri yükle'],
  de: ['Premium aktiv', 'Werbefrei aktiv', 'Abo verwalten', 'Dein Abo ist aktiv. Ein erneuter Kauf ist nicht nötig.', 'Käufe wiederherstellen'],
  fr: ['Premium actif', 'Sans publicité actif', 'Gérer l’abonnement', 'Votre abonnement est actif. Aucun nouvel achat n’est nécessaire.', 'Restaurer les achats'],
  es: ['Premium activo', 'Sin anuncios activo', 'Gestionar suscripción', 'Tu suscripción está activa. No necesitas volver a comprarla.', 'Restaurar compras'],
  it: ['Premium attivo', 'Senza pubblicità attivo', 'Gestisci abbonamento', 'Il tuo abbonamento è attivo. Non è necessario acquistarlo di nuovo.', 'Ripristina acquisti'],
  pt: ['Premium ativo', 'Sem anúncios ativo', 'Gerenciar assinatura', 'Sua assinatura está ativa. Não é necessário comprar novamente.', 'Restaurar compras'],
  nl: ['Premium actief', 'Advertentievrij actief', 'Abonnement beheren', 'Je abonnement is actief. Je hoeft het niet opnieuw te kopen.', 'Aankopen herstellen'],
  pl: ['Premium aktywne', 'Brak reklam aktywny', 'Zarządzaj subskrypcją', 'Twoja subskrypcja jest aktywna. Nie musisz kupować jej ponownie.', 'Przywróć zakupy'],
  ru: ['Premium активен', 'Без рекламы — активно', 'Управление подпиской', 'Ваша подписка активна. Повторная покупка не нужна.', 'Восстановить покупки'],
  ja: ['Premiumは有効です', '広告非表示は有効です', 'サブスクリプションを管理', 'サブスクリプションは有効です。再購入は必要ありません。', '購入を復元'],
  ko: ['Premium 이용 중', '광고 제거 이용 중', '구독 관리', '구독이 활성화되어 있습니다. 다시 구매할 필요가 없습니다.', '구매 복원'],
  zh: ['Premium 已生效', '无广告服务已生效', '管理订阅', '您的订阅已生效，无需再次购买。', '恢复购买'],
  ar: ['Premium نشط', 'إزالة الإعلانات نشطة', 'إدارة الاشتراك', 'اشتراكك نشط. لا حاجة للشراء مرة أخرى.', 'استعادة المشتريات'],
};
const keys = ['premium_active', 'ad_free_active', 'manage_subscription', 'subscription_already_active', 'restore_purchases'];
export const subscriptionTranslations: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(rows).map(([locale, values]) => [locale, Object.fromEntries(keys.map((key, i) => [key, values[i]]))]),
);

const offerCopy: Record<string, string[]> = {
  en: ['Remove advertisements shown by MegaRadio.', 'Advertisements within radio broadcasts are provided by the station and cannot be removed.', 'View local prices', 'Prices could not be loaded. Tap to retry.'],
  tr: ['MegaRadio uygulamasının gösterdiği reklamları kaldırın.', 'Radyo yayınındaki reklamlar istasyona aittir ve kaldırılamaz.', 'Yerel fiyatları gör', 'Fiyatlar yüklenemedi. Yeniden denemek için dokunun.'],
  de: ['Entferne die von MegaRadio angezeigte Werbung.', 'Werbung in Radiosendungen kommt vom Sender und kann nicht entfernt werden.', 'Lokale Preise ansehen', 'Preise konnten nicht geladen werden. Zum Wiederholen tippen.'],
  fr: ['Supprimez les publicités affichées par MegaRadio.', 'Les publicités diffusées par les stations de radio ne peuvent pas être supprimées.', 'Voir les prix locaux', 'Les prix n’ont pas pu être chargés. Touchez pour réessayer.'],
  es: ['Elimina los anuncios que muestra MegaRadio.', 'Los anuncios de las emisiones de radio pertenecen a la emisora y no se pueden eliminar.', 'Ver precios locales', 'No se pudieron cargar los precios. Toca para reintentar.'],
  it: ['Rimuovi gli annunci mostrati da MegaRadio.', 'Gli annunci nelle trasmissioni radio sono forniti dalla stazione e non possono essere rimossi.', 'Vedi i prezzi locali', 'Impossibile caricare i prezzi. Tocca per riprovare.'],
  pt: ['Remova os anúncios exibidos pelo MegaRadio.', 'Os anúncios das transmissões de rádio são da emissora e não podem ser removidos.', 'Ver preços locais', 'Não foi possível carregar os preços. Toque para tentar novamente.'],
  nl: ['Verwijder de advertenties van MegaRadio.', 'Advertenties in radio-uitzendingen komen van de zender en kunnen niet worden verwijderd.', 'Lokale prijzen bekijken', 'Prijzen konden niet worden geladen. Tik om opnieuw te proberen.'],
  pl: ['Usuń reklamy wyświetlane przez MegaRadio.', 'Reklamy w audycjach pochodzą od stacji i nie można ich usunąć.', 'Zobacz lokalne ceny', 'Nie udało się wczytać cen. Dotknij, aby ponowić.'],
  ru: ['Уберите рекламу, показываемую MegaRadio.', 'Реклама в радиоэфире принадлежит радиостанции и не может быть удалена.', 'Посмотреть местные цены', 'Не удалось загрузить цены. Нажмите, чтобы повторить.'],
  ja: ['MegaRadioが表示する広告を削除します。', 'ラジオ放送内の広告は放送局が配信しているため、削除できません。', '地域の価格を見る', '価格を読み込めませんでした。タップして再試行してください。'],
  ko: ['MegaRadio에서 표시하는 광고를 제거하세요.', '라디오 방송에 포함된 광고는 방송국에서 제공하므로 제거할 수 없습니다.', '현지 가격 보기', '가격을 불러오지 못했습니다. 탭하여 다시 시도하세요.'],
  zh: ['移除 MegaRadio 显示的广告。', '电台广播中的广告由电台提供，无法移除。', '查看当地价格', '无法加载价格。轻点重试。'],
  ar: ['أزل الإعلانات التي يعرضها MegaRadio.', 'إعلانات البث الإذاعي تقدمها المحطة ولا يمكن إزالتها.', 'عرض الأسعار المحلية', 'تعذر تحميل الأسعار. اضغط للمحاولة مجددًا.'],
};
const offerKeys = ['app_ads_only', 'broadcaster_ads_remain', 'see_store_prices', 'retry_store_prices'];
for (const [locale, values] of Object.entries(offerCopy)) {
  Object.assign(subscriptionTranslations[locale], Object.fromEntries(offerKeys.map((key, i) => [key, values[i]])));
}
