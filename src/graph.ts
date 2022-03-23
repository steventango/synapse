import Vertex from "./vertex";
import Edge from "./edge";
import { bound, card } from "./util";

export default class Graph {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  root: HTMLElement;
  vertex_layer: HTMLElement;
  vertexes: Map<string, Vertex>;
  edges: Map<string, Set<Edge>>;
  scale: number;
  draggable: boolean;
  scaling: boolean;
  offset: [number, number];
  translate: [number, number];
  scaledistance: number;
  dimensions: [number, number, number, number];

  constructor(root: HTMLElement) {
    this.vertexes = new Map();
    this.edges = new Map();
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
    this.root = root;
    this.vertex_layer = document.createElement("div");
    this.scale = 1;
    this.draggable = false;
    this.scaling = false;
    this.offset = [0, 0];
    this.translate = [0, 0];
    this.scaledistance = 0;
    this.dimensions = [0, 0, 0, 0];

    this.root.appendChild(this.canvas);
    this.root.appendChild(this.vertex_layer);
    const scale = window.devicePixelRatio;
    let w = Math.floor(window.innerWidth * scale);
    let h = Math.floor(window.innerHeight * scale);
    this.canvas.width = w;
    this.canvas.height = h;
    this.resize();

    this.root.addEventListener("mousedown", this.mousedown);
    this.root.addEventListener("touchstart", this.touchstart);
    window.addEventListener("resize", this.resize);
    document.addEventListener("wheel", this.wheel, {
      passive: false,
    });
  }

  /**
   * Event listener that handles the beginning of a drag event on a vertex.
   * @param e mousedown event
   */
  mousedown = (e: MouseEvent) => {
    this.draggable = true;
    this.offset = [e.clientX, e.clientY];
    document.addEventListener("mouseup", this.mouseup);
    document.addEventListener("mousemove", this.mousemove);
  };

  /**
   * Event listener that handles the dragging of a vertex.
   * @param e mousedown event
   */
  mousemove = (e: MouseEvent) => {
    e.preventDefault();
    const width = this.dimensions[1] - this.dimensions[3];
    const height = this.dimensions[2] - this.dimensions[0];
    if (this.draggable) {
      this.translate[0] += e.clientX - this.offset[0];
      this.translate[1] += e.clientY - this.offset[1];
      this.offset = [e.clientX, e.clientY];
      this.translate[0] = bound(
        -width / 2,
        this.translate[0],
        width / 2,
      );
      this.translate[1] = bound(
        -height / 2,
        this.translate[1],
        height / 2,
      );
      this.vertex_layer.style.transform = `translate(${this.translate[0]}px, ${
        this.translate[1]
      }px) scale(${this.scale})`;
    }
    this.draw();
  };

  /**
   * Event listener that handles the beginning of a pan on graph.
   * @param e mouseup event
   */
  mouseup = () => {
    this.draggable = false;
    document.removeEventListener("mouseup", this.mouseup);
    document.removeEventListener("mousemove", this.mousemove);
  };

  /**
   * Event listener that handles the beginning of a pan on graph.
   * @param e touchstart event
   */
  touchstart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      this.scaling = true;
      e.preventDefault();
      this.scaledistance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY,
      );
    } else {
      this.draggable = true;
      for (const touch of e.changedTouches) {
        if (this.root.contains(<Node> (touch.target))) {
          this.offset = [touch.clientX, touch.clientY];
        }
      }
    }
    document.addEventListener("touchmove", this.touchmove);
    document.addEventListener("touchend", this.touchend);
    document.addEventListener("touchcancel", this.touchcancel);
  };

  /**
   * Event listener that handles the panning of the graph.
   * @param e touchmove event
   */
  touchmove = (e: TouchEvent) => {
    if (this.scaling) {
      e.preventDefault();
      const factor = (Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY,
      ) / this.scaledistance - 1) / 10 + 1;
      this.rescale(factor);
    } else {
      const width = this.dimensions[1] - this.dimensions[3];
      const height = this.dimensions[2] - this.dimensions[0];
      if (this.draggable) {
        for (const touch of e.changedTouches) {
          if (this.root.contains(<Node> (touch.target))) {
            this.translate[0] += touch.clientX - this.offset[0];
            this.translate[1] += touch.clientY - this.offset[1];
            this.offset = [touch.clientX, touch.clientY];
            this.translate[0] = bound(
              -width / 2,
              this.translate[0],
              width / 2,
            );
            this.translate[1] = bound(
              -height / 2,
              this.translate[1],
              height / 2,
            );
            this.vertex_layer.style.transform = `translate(${
              this.translate[0]
            }px, ${this.translate[1]}px) scale(${this.scale})`;
          }
        }
      }
      this.draw();
    }
  };

  /**
   * Event listener that handles the end of a graph pan.
   * @param e mousedown event
   */
  touchend = () => {
    this.scaling = false;
    this.draggable = false;
    document.removeEventListener("touchend", this.touchend);
    document.removeEventListener("touchmove", this.touchmove);
    document.removeEventListener("touchcancel", this.touchcancel);
  };

  /**
   * Event listener that handles the end of a graph pan.
   * @param e mousedown event
   */
  touchcancel = () => {
    this.scaling = false;
    this.draggable = false;
    document.removeEventListener("touchend", this.touchend);
    document.removeEventListener("touchmove", this.touchmove);
    document.removeEventListener("touchcancel", this.touchcancel);
  };

  get size() {
    return this.vertexes.size;
  }

  /**
   * Calculate dimensions.
   */
  calculate_dim() {
    // top, right, bottom, left
    for (const [_, vertex] of this.vertexes) {
      const x = vertex.e.offsetLeft;
      const y = vertex.e.offsetTop;
      if (y < this.dimensions[0]) {
        this.dimensions[0] = y;
      }
      if (x > this.dimensions[1]) {
        this.dimensions[1] = x;
      }
      if (y > this.dimensions[2]) {
        this.dimensions[2] = y;
      }
      if (x < this.dimensions[3]) {
        this.dimensions[3] = x;
      }
    }
  }

  /**
   * determines if the course is already in the graph
   * @param courseTitle the course title
   * @returns if the course is found in the graph
   */
  isFound = (courseTitle: string): boolean => {
    return this.vertexes.has(courseTitle);
  };

  /**
   * Clear the graph of all vertexes and edges
   */
  clear = () => {
    for (const [_, vertex] of this.vertexes) {
      vertex.remove();
    }
    this.edges.clear();
    this.draw();
    this.root.dispatchEvent(new Event("graph:change"));
  };

  /**
   * Handle resize events
   */
  resize = () => {
    const scale = window.devicePixelRatio;
    let w = Math.floor(window.innerWidth * scale);
    let h = Math.floor(window.innerHeight * scale);
    let xfactor = w / this.canvas.width;
    let yfactor = h / this.canvas.height;
    this.canvas.width = w;
    this.canvas.height = h;
    if (xfactor > 1 || yfactor > 1) {
      this.scale *= Math.min(xfactor, yfactor);
    } else {
      this.scale *= Math.max(xfactor, yfactor);
    }
    this.scale = bound(0.05, this.scale, 5);

    this.vertex_layer.style.transform = `translate(${this.translate[0]}px, ${
      this.translate[1]
    }px) scale(${this.scale})`;
    this.ctx.scale(scale, scale);
    this.draw();
    this.calculate_dim();
  };

  /**
   * Handle wheel events
   * @param e wheel event
   */
  wheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
    let factor: number;
    if (e.deltaY > 0) {
      factor = 0.9;
    } else {
      factor = 1.1;
    }
    this.rescale(factor);
  };

  /**
   * Scale graph
   * @param factor scaling factor
   */
  rescale = (factor: number) => {
    this.scale *= factor;
    this.scale = bound(0.05, this.scale, 5);

    this.vertex_layer.style.transform = `translate(${this.translate[0]}px, ${
      this.translate[1]
    }px) scale(${this.scale})`;
    this.draw();
  };

  /**
   * Adds a vertex to the graph
   * @param vertex vertex to add to the graph
   */
  addVertex = (vertex: Vertex) => {
    this.vertexes.set(vertex.id, vertex);
    this.vertex_layer.appendChild(vertex.e);
    vertex.graph = this;
    this.calculate_dim();
    this.root.dispatchEvent(new Event("graph:change"));
  };

  /**
   * Adds an edge to the graph.
   * @param edge edge to add to the graph
   */
  addEdge = (edge: Edge) => {
    if (!this.edges.has(edge.u)) {
      this.edges.set(edge.u, new Set());
    }
    this.edges.get(edge.u)?.add(edge);
    if (edge.type === "coreq") {
      const reverse = new Edge(edge.v, edge.u, edge.color, edge.type);
      this.edges.get(edge.v)?.add(reverse);
    }
  };

  /**
   * Draws the graph.
   */
  draw = () => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const width = card.width * this.scale;
    const height = card.height * this.scale;
    for (const [_, edges] of this.edges) {
      for (const edge of edges) {
        const a = this.vertexes.get(edge.u);
        const b = this.vertexes.get(edge.v);
        if (a && b) {
          const rect_a = a.e.getBoundingClientRect();
          const rect_b = b.e.getBoundingClientRect();
          let x1 = rect_a.left + window.scrollX;
          let y1 = rect_a.top + window.scrollY;
          let x2 = rect_b.left + window.scrollX;
          let y2 = rect_b.top + window.scrollY;
          let angle = 0;
          if (edge.type === "prereq") {
            x1 += width / 2;
            y1 += height;
            x2 += width / 2;
            angle = Math.PI / 2;
          } else if (edge.type === "coreq") {
            if (x1 < x2) {
              x1 += width;
            } else {
              x2 += width;
            }
            y1 += height / 2;
            y2 += height / 2;
            angle = Math.atan2(y2 - y1, x2 - x1);
          }

          this.ctx.lineWidth = 1 * this.scale;
          this.ctx.strokeStyle = edge.color;

          this.ctx.beginPath();
          this.ctx.moveTo(x1, y1);
          if (edge.type === "coreq") {
            // draw start arrow head
            this.ctx.lineTo(
              x1 + 10 * Math.cos(angle - Math.PI / 6) * this.scale,
              y1 + 10 * Math.sin(angle - Math.PI / 6) * this.scale,
            );
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(
              x1 + 10 * Math.cos(angle + Math.PI / 6) * this.scale,
              y1 + 10 * Math.sin(angle + Math.PI / 6) * this.scale,
            );
            this.ctx.moveTo(x1, y1);
          }

          if (Math.abs(x2 - x1) < 32 || edge.type === "coreq") {
            this.ctx.lineTo(x2, y2);
          } else {
            this.ctx.bezierCurveTo(
              x1,
              y1 + width / 2,
              x2,
              y2 - width / 2,
              x2,
              y2,
            );
          }

          // draw end arrow head
          this.ctx.lineTo(
            x2 - 10 * Math.cos(angle - Math.PI / 6) * this.scale,
            y2 - 10 * Math.sin(angle - Math.PI / 6) * this.scale,
          );
          this.ctx.moveTo(x2, y2);
          this.ctx.lineTo(
            x2 - 10 * Math.cos(angle + Math.PI / 6) * this.scale,
            y2 - 10 * Math.sin(angle + Math.PI / 6) * this.scale,
          );
          this.ctx.stroke();
        } else {
          edges.delete(edge);
        }
      }
    }
  };
}
