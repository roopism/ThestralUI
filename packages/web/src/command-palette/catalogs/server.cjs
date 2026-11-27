// Generated from packages/messages by renderer.mjs.
exports.loadCatalog = function (language) {
  switch (language) {
    case 'ar': return require('./ar.mjs').default;
    case 'de': return require('./de.mjs').default;
    case 'es': return require('./es.mjs').default;
    case 'fr': return require('./fr.mjs').default;
    case 'he': return require('./he.mjs').default;
    case 'hi': return require('./hi.mjs').default;
    case 'ja': return require('./ja.mjs').default;
    case 'pt-BR': return require('./pt-BR.mjs').default;
    case 'zh-Hans': return require('./zh-Hans.mjs').default;
    default: throw Error('Unsupported command catalog ' + language);
  }
};
