export default class Edge {
  u: string;
  v: string;
  color: string;
  type: string;

  constructor(u: string, v: string, color = "#000000", type = "prereq") {
    this.u = u;
    this.v = v;
    this.color = color;
    this.type = type;
  }
}
