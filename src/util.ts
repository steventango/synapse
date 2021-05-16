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
