/**
 * The design-system token source of truth. Authored as a typed object so components (later slices)
 * import it directly and Lighter's ingestion consumes the built `dist/tokens.json`. Groups here
 * are the five foundations: color ramps, type scale, spacing, radii, shadows.
 */
export interface Tokens {
  color: Record<string, Record<string, string>>;
  fontSize: Record<string, string>;
  space: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
}

export const tokens: Tokens = {
  color: {
    neutral: {
      '50': '#f8fafc',
      '100': '#f1f5f9',
      '300': '#cbd5e1',
      '500': '#64748b',
      '700': '#334155',
      '900': '#0f172a',
    },
    blue: {
      '50': '#eff6ff',
      '100': '#dbeafe',
      '300': '#93c5fd',
      '500': '#3b82f6',
      '700': '#1d4ed8',
      '900': '#1e3a8a',
    },
    green: {
      '100': '#dcfce7',
      '500': '#22c55e',
      '700': '#15803d',
    },
    red: {
      '100': '#fee2e2',
      '500': '#ef4444',
      '700': '#b91c1c',
    },
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '2.5rem',
  },
  space: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '6': '1.5rem',
    '8': '2rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.75rem',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  },
};
