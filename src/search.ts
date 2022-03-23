import { card, random_color, rsplit } from "./util";
import Graph from "./graph";
import Vertex from "./vertex";
import Edge from "./edge";
import { Subject } from "./university";

const margin = 16;

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
    console.log(JSON.parse(JSON.stringify(stack)).map((v: Array<Array<string>>) => v[0].join(" ")));
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
          console.log(code, depth);
          const v = new Vertex(
            {
              code: code,
              name: courses[department][number].name,
            },
            x,
            depth * (card.height + 2 * margin) + margin,
          );

          graph.addVertex(v);
        } else {
          const v = graph.vertexes.get(code)!;
          const rect = v.e.getBoundingClientRect();
          v.e.style.top = rect.top + card.width + "px";
        }

        const types: ["prereqs", "coreqs"] = ["prereqs", "coreqs"];
        for (const type of types) {
          if (type in course) {
            let reqlen = 0;
            for (const requisites of course[type]!.sort()) {
              for (const requisite of requisites.sort()) {
                const [department, number] = rsplit(requisite);
                if (courses[department]) {
                  if (courses[department][number]) {
                    if (!explored.has(requisite)) {
                      ++reqlen;
                    }
                  }
                }
              }
            }
            let i = 0;
            for (const requisites of course[type]!.sort()) {
              const color = random_color();
              for (const requisite of requisites.sort()) {
                const [department, number] = rsplit(requisite);
                let e = new Edge(code, requisite, color, type.slice(0, -1));
                graph.addEdge(e);
                if (!explored.has(requisite)) {
                  explored.add(requisite);
                  let newx = x + (i - Math.floor(reqlen / 2)) * (card.width + margin);
                  stack.push([rsplit(requisite), [newx, depth + 1]]);
                  if (courses[department]) {
                    if (courses[department][number]) {
                      ++i;
                    }
                  }
                } else {
                  for (const index in stack) {
                    if (stack[index][0][0] === rsplit(requisite)[0]) {
                      stack[index][1][1] = Math.max(stack[index][1][1], depth + 1);
                      break;
                    }
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
