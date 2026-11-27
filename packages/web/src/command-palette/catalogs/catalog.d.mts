type Labels = { search: string; empty: string; close: string };
export function loadCatalog(language: string): Labels | Promise<Labels>;
