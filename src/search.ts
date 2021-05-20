import { random_color, rsplit } from "./util";
import Graph, { Edge, Vertex } from "./graph";
import { Subject } from "./university";

const card = {
  width: 128,
  height: 72,
};

/**
 * Builds a requisite graph from a course search
 * @param graph graph
 * @param code course code from search
 * @param courses course data
 * @returns whether the course was found in course data
 */
export default function search(
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
