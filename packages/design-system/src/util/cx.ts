/** Join truthy class names. Tiny, dependency-free `classnames`. */
export type ClassValue = string | number | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
