/** Syntax only: this does not establish provider approval or brand ownership. */
export function isValidSmsSender(value: string): boolean {
  return value.length >= 1 && value.length <= 11 && /[A-Za-z]/.test(value) && !/[^A-Za-z0-9 .-]/.test(value);
}
