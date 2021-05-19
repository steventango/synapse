export function random_color() {
    const r = Math.floor(200 + Math.random() * 255) / 2;
    const g = Math.floor(200 + Math.random() * 255) / 2;
    const b = Math.floor(200 + Math.random() * 255) / 2;
    return `rgb(${r}, ${g}, ${b})`;
}
export function rsplit(string, separator = " ") {
    const index = string.lastIndexOf(separator);
    return [string.substring(0, index), string.substring(index + 1)];
}
//# sourceMappingURL=util.js.map