/** Small injectable clock seam for time-based rules and deterministic tests. */
export const clock = {
  now: (): Date => new Date(),
};
