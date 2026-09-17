/** Minimal class-name joiner for the copied animate-ui primitives (no Tailwind here). */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
