import Graph, { Edge, Vertex } from "./graph";
import { random_color, rsplit } from "./util";
import { Subject, University } from "./university";
import { MDCIconButtonToggle } from "@material/icon-button";
import { MDCSnackbar } from "@material/snackbar";
import { MDCTextField } from "@material/textfield";

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
  const graph_element: HTMLElement = document.querySelector(
    "#graph",
  )!;

  const graph: Graph = new Graph(graph_element);

  const search_bar = new MDCTextField(document.querySelector("#search_bar")!);

  const delete_button: HTMLButtonElement = document.querySelector(
    "#delete_button",
  )!;
  const iconToggle = new MDCIconButtonToggle(
    document.querySelector("#toggle_theme")!,
  );

  const snackbar = new MDCSnackbar(document.querySelector("#snackbar")!);

  search_bar.root.addEventListener("focusin", () => {
    search_bar.root.classList.add("mdc-elevation--z4");
  });

  search_bar.root.addEventListener("focusout", () => {
    search_bar.root.classList.remove("mdc-elevation--z4");
  });

  search_bar.root.addEventListener("change", () => {
    let query = search_bar.value.toUpperCase();
    // trim left and right
    query = query.trim();
    // if already in graph, give a notice
    if (graph.isFound(query)) {
      search_bar.root.classList.add("mdc-text-field--invalid");
      snackbar.labelText = "Course is already in graph";
      snackbar.open();
      return;
    }
    if (query.length) {
      if (!query.includes(" ")) {
        const index = query.search(/\d/);
        query = query.slice(0, index) + " " + query.slice(index);
      }
      if (search(graph, query, data.courses)) {
        search_bar.root.querySelector("input")!.placeholder = "";
        search_bar.root.classList.remove("mdc-text-field--invalid");
        search_bar.value = "";
      } else {
        search_bar.root.classList.add("mdc-text-field--invalid");
        snackbar.labelText = "Course not found";
        snackbar.open();
      }
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
    if (graph.size === 0) {
      return;
    }
    if (confirm("Clear all courses?")) {
      graph.clear();
    }
  });

  iconToggle.listen<CustomEvent<{ isOn: boolean }>>(
    "MDCIconButtonToggle:change",
    (event) => {
      if (event.detail.isOn) {
        document.body.classList.add("dark");
      } else {
        document.body.classList.remove("dark");
      }
    },
  );
}

main();
