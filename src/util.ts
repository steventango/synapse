/**
 * Generates and returns a random color that is close to rgb(200, 200, 200)
 * @returns a random color
 */
 export function random_color() {
  const r = Math.floor(200 + Math.random() * 255) / 2;
  const g = Math.floor(200 + Math.random() * 255) / 2;
  const b = Math.floor(200 + Math.random() * 255) / 2;

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Splits on the rightmost occurence of separator.
 * @param string string to split
 * @param separator characters to split by
 * @returns 2-tuple of split string
 */
export function rsplit(string: string, separator: string = " ") {
  const index = string.lastIndexOf(separator);
  return [string.substring(0, index), string.substring(index  + 1)];
}

/**
 * Bound x between a and b.
 * @param a lower bound
 * @param x variable
 * @param b upper bound
 * @returns bounded x
 */
export function bound(a: number, x: number, b: number) {
  return Math.max(a, Math.min(x, b));
}
