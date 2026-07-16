import type { InventoryToken } from './inventory.js';

/** A category and its tokens, ready to render as one section of the token inventory. */
export interface TokenCategory {
  category: string;
  tokens: InventoryToken[];
}

/** The design system's foundational categories, in the order a reader expects to scan them. */
const PREFERRED_ORDER = ['color', 'fontSize', 'space', 'radius', 'shadow'];

/**
 * Group inventory tokens by their category into render-ready sections. The five foundational
 * categories lead in a fixed reading order; any other category a design system introduces follows
 * alphabetically. Token order within a category is preserved as received from the API.
 */
export function groupTokensByCategory(tokens: InventoryToken[]): TokenCategory[] {
  const byCategory = new Map<string, InventoryToken[]>();
  for (const token of tokens) {
    const bucket = byCategory.get(token.category);
    if (bucket) bucket.push(token);
    else byCategory.set(token.category, [token]);
  }

  const categories = [...byCategory.keys()].sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a);
    const ib = PREFERRED_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return categories.map((category) => ({ category, tokens: byCategory.get(category)! }));
}
