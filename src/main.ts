import Graph, { Edge, Vertex } from "./graph.js";
import { random_color, rsplit } from "./util.js";
import { Subject, University } from "./university";
declare var mdc: any;

const card = {
  width: 128,
  height: 72,
};

/**
 * Fetches university data from Github Raw as JSON.
 * @returns university data
 */
async function load(): Promise<University> {
  const url = "//raw.githubusercontent.com/steventango/synapse/master/data/" +
    "ualberta.ca.json";
  const response = await fetch(url);
  return response.json();
}

/**
 * Builds a requisite graph from a course search
 * @param graph graph
 * @param code course code from search
 * @param courses course data
 * @returns whether the course was found in course data
 */
function search(
  graph: Graph,
  code: string,
  courses: Subject,
) {
  const explored = new Set();
  const stack: Array<[string[], number[]]> = [];
  stack.push([rsplit(code), [
    Math.random() * window.innerWidth / 3 + window.innerWidth / 3,
    0,
  ]]);
  let found = false;

  while (stack.length) {
    const [req, [x, depth]] = stack.pop() || [["", ""], [0, 0]];
    let [department, number] = req || [];
    department = department.trim();
    number = number.trim();
    const code = `${department} ${number}`;
    // MOVE DRAWING OUT OF GRAPH MAKING
    if (courses[department]) {
      const course = courses[department][number];
      if (course) {
        if (!graph.vertexes.has(code)) {
          const v = new Vertex(
            {
              code: code,
              name: courses[department][number].name,
            },
            x,
            depth * card.width + 16,
          );

          graph.addVertex(v);
        } else {
          const v = graph.vertexes.get(code)!;
          const rect = v.e.getBoundingClientRect();
          v.e.style.top = rect.top + card.width + "px";
        }
        if (course.prereqs) {
          let reqlen = 0;
          for (const prereqs of course.prereqs) {
            for (const prereq of prereqs) {
              const [department, number] = rsplit(prereq);
              if (courses[department]) {
                if (courses[department][number]) {
                  ++reqlen;
                }
              }
            }
          }
          let i = 0;
          for (const prereqs of course.prereqs) {
            const color = random_color();
            for (const prereq of prereqs) {
              const [department, number] = rsplit(prereq);
              let e = new Edge(code, prereq, color);
              graph.addEdge(e);
              if (!explored.has(prereq)) {
                explored.add(prereq);
                let newx = Math.min(
                  Math.max(
                    x +
                      (i - reqlen / 2) * (card.width + 8),
                    160 * Math.random(),
                  ),
                  window.innerWidth - card.width - 160 * Math.random(),
                );
                stack.push([rsplit(prereq), [newx, depth + 1]]);
                if (courses[department]) {
                  if (courses[department][number]) {
                    ++i;
                  }
                }
              }
            }
          }
        }
        if (course.coreqs) {
          let reqlen = 0;
          for (const coreqs of course.coreqs) {
            for (const coreq of coreqs) {
              const [department, number] = rsplit(coreq);
              if (courses[department]) {
                if (courses[department][number]) {
                  ++reqlen;
                }
              }
            }
          }
          let i = 0;
          for (const coreqs of course.coreqs) {
            const color = random_color();
            for (const coreq of coreqs) {
              const [department, number] = rsplit(coreq);
              let e = new Edge(code, coreq, color, "coreq");
              graph.addEdge(e);
              if (!explored.has(coreq)) {
                explored.add(coreq);
                let newx = Math.min(
                  Math.max(
                    x +
                      (i - reqlen / 2) * (window.innerWidth) / reqlen,
                    0,
                  ),
                  window.innerWidth - card.width,
                );
                stack.push([rsplit(coreq), [newx, depth + 1]]);
                if (courses[department]) {
                  if (courses[department][number]) {
                    ++i;
                  }
                }
              }
            }
          }
        }
        found = true;
      }
    }
  }

  graph.draw();
  return found;
}

async function main() {
  const data = await load();
  const main = document.querySelector("main")!;
  const graph_element: HTMLElement = document.querySelector(
    "#graph",
  )!;
  const graph: Graph = new Graph(graph_element);

  const search_input: HTMLInputElement = document.querySelector("#search")!;
  const search_bar: HTMLInputElement = document.querySelector("#search_bar")!;
  const error_notice: HTMLInputElement = document.querySelector(".error")!;
  const delete_button: HTMLButtonElement = document.querySelector(
    "#delete_button",
  )!;
  const iconToggle = new mdc.iconButton.MDCIconButtonToggle(
    document.querySelector("#toggle_theme"),
  );

  const snackbar: HTMLButtonElement = document.querySelector(".mdc-snackbar")!;
  const snackbar_text: HTMLButtonElement = document.querySelector(
    ".mdc-snackbar__label",
  )!;

  search_bar.addEventListener("focusin", () => {
    search_bar.classList.add("mdc-elevation--z4");
  });

  search_bar.addEventListener("focusout", () => {
    search_bar.classList.remove("mdc-elevation--z4");
  });

  search_input.addEventListener("change", () => {
    let query = search_input.value.toUpperCase();
    // trim left and right
    query = query.trim();
    if (!query.includes(" ")) {
      const index = query.search(/\d/);
      query = query.slice(0, index) + " " + query.slice(index);
    }
    if (search(graph, query, data.courses)) {
      search_input.value = "";
      search_input.placeholder = "";
      search_bar.classList.remove("mdc-text-field--invalid");
    } else {
      search_bar.classList.add("mdc-text-field--invalid");
      // show error

      // show
      // snackbar_text.innerHTML = "Course not found"; // This course is already in the graph
      // snackbar.style.display = "block";
    }
  });

  graph_element.addEventListener("graph:change", () => {
    if (graph.size) {
      delete_button.style.display = "inline";
    } else {
      delete_button.style.display = "none";
    }
  });

  delete_button.addEventListener("click", () => {
    // if nothing to delete, do not display message
    if (graph.size == 0) {
      return;
    }
    if (confirm("Clear all courses?")) {
      graph.clear();
    }
  });

  iconToggle.listen(
    "MDCIconButtonToggle:change",
    (e: { detail: { isOn: boolean } }) => {
      if (e.detail.isOn) {
        document.body.classList.add("dark");
      } else {
        document.body.classList.remove("dark");
      }
    },
  );
}

main();
