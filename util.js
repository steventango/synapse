export function rsplit(string, separator = " ") {
    const index = string.lastIndexOf(separator);
    return [string.substring(0, index), string.substring(index + 1)];
}
//# sourceMappingURL=util.js.map