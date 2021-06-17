import { rsplit } from "./util";
import Graph from "./graph";

export default class Vertex {
  e: HTMLElement;
  draggable: boolean;
  offset: [number, number];
  id: string;
  graph?: Graph;
  courseCode?: string;

  get getCourseCode() {
    return this.courseCode;
  }

  /**
   * Event listener that handles the beginning of a drag event on a vertex.
   * @param e mousedown event
   */
  mousedown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.draggable = true;
    if (this.graph) {
      const scale = this.graph.scale;
      this.offset = [
        this.e.offsetLeft - e.clientX / scale,
        this.e.offsetTop - e.clientY / scale,
      ];
    }
    this.e.classList.remove("mdc-elevation--z1");
    this.e.classList.add("mdc-elevation--z4");
    document.addEventListener("mouseup", this.mouseup);
    document.addEventListener("mousemove", this.mousemove);
  };

  /**
   * Event listener that handles the dragging of a vertex.
   * @param e mousemove event
   */
  mousemove = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.draggable) {
      if (this.graph) {
        const scale = this.graph.scale;
        this.e.style.left = e.clientX / scale + this.offset[0] + "px";
        this.e.style.top = e.clientY / scale + this.offset[1] + "px";
        this.graph.draw();
      }
    }
  };

  /**
   * Event listener that handles the end of a drag event on a vertex.
   * @param e mouseup event
   */
  mouseup = (e: MouseEvent) => {
    e.stopPropagation();
    this.draggable = false;
    this.e.classList.remove("mdc-elevation--z4");
    this.e.classList.add("mdc-elevation--z1");
    document.removeEventListener("mouseup", this.mouseup);
    document.removeEventListener("mousemove", this.mousemove);
    this.graph?.calculate_dim();
  };

  /**
   * Event listener that handles the beginning of a drag event on a vertex.
   * @param e touchstart event
   */
  touchstart = (e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.draggable = true;
    if (this.graph) {
        for (const touch of e.changedTouches) {
          if (this.e.contains(<Node>(touch.target))) {
            const scale = this.graph.scale;
            this.offset = [
              this.e.offsetLeft - touch.clientX / scale,
              this.e.offsetTop - touch.clientY / scale,
            ];
          }
      }
    }
    this.e.classList.remove("mdc-elevation--z1");
    this.e.classList.add("mdc-elevation--z4");
    document.addEventListener("touchend", this.touchend);
    document.addEventListener("touchmove", this.touchmove);
    document.addEventListener("touchcancel", this.touchcancel);
  };

  /**
   * Event listener that handles the dragging of a vertex.
   * @param e touchmove event
   */
  touchmove = (e: TouchEvent) => {
    e.stopPropagation();
    if (this.draggable) {
      if (this.graph) {
        for (const touch of e.changedTouches) {
          if (this.e.contains(<Node>(touch.target))) {
            const scale = this.graph.scale;
            this.e.style.left = touch.clientX / scale + this.offset[0] + "px";
            this.e.style.top = touch.clientY / scale + this.offset[1] + "px";
            this.graph.draw();
          }
        }
      }
    }
  };

  /**
   * Event listener that handles the end of a drag event on a vertex.
   * @param e touchend event
   */
  touchend = (e: TouchEvent) => {
    e.stopPropagation();
    this.draggable = false;
    this.e.classList.remove("mdc-elevation--z4");
    this.e.classList.add("mdc-elevation--z1");
    document.removeEventListener("touchend", this.touchend);
    document.removeEventListener("touchmove", this.touchmove);
    document.removeEventListener("touchcancel", this.touchcancel);
    this.graph?.calculate_dim();
  };

  /**
 * Event listener that handles the cancelling of a drag event on a vertex.
 * @param e touchcancel event
 */
  touchcancel = (e: TouchEvent) => {
    e.stopPropagation();
    this.draggable = false;
    this.e.classList.remove("mdc-elevation--z4");
    this.e.classList.add("mdc-elevation--z1");
    document.removeEventListener("mouseup", this.mouseup);
    document.removeEventListener("mousemove", this.mousemove);
    document.removeEventListener("touchcancel", this.touchcancel);
    this.graph?.calculate_dim();
  };

  /**
   * Removes vertex from graph.
   */
  remove = () => {
    if (this.graph) {
      this.graph.vertexes.delete(this.id);
      // TODO: smart remove by removing children that ONLY depend on the thing removed
      // remove upward edges
      // remove downward edges
      this.graph.draw();
      this.graph.root.dispatchEvent(new Event("graph:change"));
      this.graph.calculate_dim();
    }
    this.e.parentElement?.removeChild(this.e);
  };

  constructor(course: { code: string; name: string }, x?: number, y?: number) {
    this.courseCode = course.code;
    this.e = document.createElement("div");
    this.e.classList.add("mdc-card", "vertex", "mdc-elevation--z1");
    this.e.innerHTML = `
      <h2 class="mdc-typography mdc-typography--headline6">${course.code}</h2>
      <h3 class="mdc-typography mdc-typography--subtitle2">${course.name}</h3>
      <div class="mdc-card__action-icons">
      <a href="${"https://apps.ualberta.ca/catalogue/course/"}${
      rsplit(course.code).join("/").replace(" ", "_")
    }" target="_blank" class="mdc-icon-button material-icons mdc-card__action mdc-card__action--icon" aria-label="More" title="View ${course.code} - ${course.name}">
      open_in_new
      </a>
      <button class="mdc-icon-button material-icons mdc-card__action mdc-card__action--icon" aria-label="Remove" title="Delete course">
      delete
      </button>
    </div>`;

    this.e.querySelector(".mdc-card__action-icons")!
      .addEventListener(
        "mousedown",
        (event) => {
          event.stopPropagation();
        },
      );

    this.e.querySelector('.mdc-icon-button[aria-label="Remove"]')!
      .addEventListener(
        "click",
        this.remove,
      );

    this.draggable = false;
    this.offset = [0, 0];
    this.id = course.code;

    if (x !== null) {
      this.e.style.left = x + "px";
    }

    if (y !== null) {
      this.e.style.top = y + "px";
    }

    this.e.addEventListener("mousedown", this.mousedown);
    this.e.addEventListener("touchstart", this.touchstart);
  }
}
