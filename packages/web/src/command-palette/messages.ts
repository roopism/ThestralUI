// Generated from packages/messages by renderer.mjs.
export function commandLabels(locale: string) {
  const [language, variant] = locale.split('-');
  switch (language) {
    case 'ar':
      return {
        "search": "البحث في الأوامر",
        "empty": "لا توجد أوامر مطابقة",
        "close": "إغلاق"
      };
    case 'de':
      return {
        "search": "Befehle suchen",
        "empty": "Keine passenden Befehle",
        "close": "Schließen"
      };
    case 'en':
      return {
        "search": "Search commands",
        "empty": "No matching commands",
        "close": "Close"
      };
    case 'es':
      return {
        "search": "Buscar comandos",
        "empty": "No hay comandos coincidentes",
        "close": "Cerrar"
      };
    case 'fr':
      return {
        "search": "Rechercher des commandes",
        "empty": "Aucune commande correspondante",
        "close": "Fermer"
      };
    case 'he':
      return {
        "search": "חיפוש פקודות",
        "empty": "לא נמצאו פקודות תואמות",
        "close": "סגירה"
      };
    case 'hi':
      return {
        "search": "कमांड खोजें",
        "empty": "कोई मेल खाता कमांड नहीं मिला",
        "close": "बंद करें"
      };
    case 'ja':
      return {
        "search": "コマンドを検索",
        "empty": "一致するコマンドはありません",
        "close": "閉じる"
      };
    case 'pt':
      return {
        "search": "Pesquisar comandos",
        "empty": "Nenhum comando correspondente",
        "close": "Fechar"
      };
    case 'zh':
      if (['Hant', 'HK', 'MO', 'TW'].includes(variant)) break;
      return {
        "search": "搜索命令",
        "empty": "没有匹配的命令",
        "close": "关闭"
      };
  }
}
