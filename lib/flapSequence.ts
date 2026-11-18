const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
// How many flaps a change may show at most, so a board update stays quick.
export const MAX_RUN = 6;

/**
 * The characters a flap shows on its way from `from` to `to`, ending with `to`.
 * Letters and digits run in order through the few characters just before the target
 * (A→B→C), like a real split-flap drum. Blanks and symbols flip straight to the target,
 * so a change never flashes stray punctuation.
 */
export function flapSequence(from: string, to: string): string[] {
  if (from === to) return [];
  const group = LETTERS.includes(to) ? LETTERS : DIGITS.includes(to) ? DIGITS : "";
  if (!group) return [to];
  const end = group.indexOf(to);
  let start = Math.max(0, end - MAX_RUN + 1);
  const at = group.indexOf(from);
  if (at >= start && at < end) start = at + 1;
  return group.slice(start, end + 1).split("");
}
