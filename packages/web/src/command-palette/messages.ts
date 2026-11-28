// Generated from packages/messages by renderer.mjs.
import { loadCatalog } from '#command-palette-catalog';

export function commandLabels(locale: string) {
  const [language, variant] = locale.split('-');
  switch (language) {
    case 'ar':
      return loadCatalog('ar');
    case 'de':
      return loadCatalog('de');
    case 'en':
      return {"search":"Search commands","empty":"No matching commands","close":"Close"};
    case 'es':
      return loadCatalog('es');
    case 'fr':
      return loadCatalog('fr');
    case 'he':
      return loadCatalog('he');
    case 'hi':
      return loadCatalog('hi');
    case 'ja':
      return loadCatalog('ja');
    case 'pt':
      return loadCatalog('pt-BR');
    case 'zh':
      if (['Hant', 'HK', 'MO', 'TW'].includes(variant)) break;
      return loadCatalog('zh-Hans');
  }
}
