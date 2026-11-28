import { loaders } from './imports.mjs';

const catalogs = new Map();
export function loadCatalog(language) {
  if (!catalogs.has(language)) {
    catalogs.set(language, loaders[language]().then(module => module.default, () => undefined));
  }
  return catalogs.get(language);
}
