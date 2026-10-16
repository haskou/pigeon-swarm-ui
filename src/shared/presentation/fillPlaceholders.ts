/**
 * Fills `{name}` placeholders in one pass, inserting every value literally,
 * so untrusted values can neither use replacement patterns nor fill other
 * placeholders.
 */
export function fillPlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? values[name]
      : placeholder,
  );
}
