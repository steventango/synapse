import Graph, { Edge, Vertex } from "./graph.js";
const card = {
    width: 128,
    height: 72,
};
function random_color() {
    const r = Math.floor(200 + Math.random() * 255) / 2;
    const g = Math.floor(200 + Math.random() * 255) / 2;
    const b = Math.floor(200 + Math.random() * 255) / 2;
    return `rgb(${r}, ${g}, ${b})`;
}
async function load() {
    const response = await fetch("https://raw.githubusercontent.com/steventango/synapse/master/data/ualberta.ca.json");
    return response.json();
}
function search(graph, code, courses, explored = new Set()) {
    const stack = [];
    stack.push([code.split(" "), [
            Math.random() * window.innerWidth / 3 + window.innerWidth / 3,
            0,
        ]]);
    let found = false;
    while (stack.length) {
        const [req, [x, depth]] = stack.pop() || [["", ""], [0, 0]];
        const [department, number] = req || [];
        const code = `${department} ${number}`;
        if (courses[department]) {
            if (courses[department][number]) {
                if (!graph.vertexes.has(code)) {
                    const v = new Vertex({
                        code: code,
                        name: courses[department][number].name,
                    }, x, depth * card.width + 16);
                    graph.addVertex(v);
                }
                else {
                    const v = graph.vertexes.get(code);
                    const rect = v.e.getBoundingClientRect();
                    v.e.style.top = rect.top + card.width + "px";
                }
                if (courses[department][number].prereqs) {
                    let reqlen = 0;
                    for (const prereqs of courses[department][number].prereqs) {
                        for (const prereq of prereqs) {
                            const [department, number] = prereq.split(' ');
                            if (courses[department]) {
                                if (courses[department][number]) {
                                    ++reqlen;
                                }
                            }
                        }
                    }
                    let i = 0;
                    for (const prereqs of courses[department][number].prereqs) {
                        const color = random_color();
                        for (const prereq of prereqs) {
                            const [department, number] = prereq.split(' ');
                            let e = new Edge(code, prereq, color);
                            graph.addEdge(e);
                            if (!explored.has(prereq)) {
                                explored.add(prereq);
                                let newx = Math.min(Math.max(x +
                                    (i - reqlen / 2) * (card.width + 8), 160 * Math.random()), window.innerWidth - card.width - 160 * Math.random());
                                stack.push([prereq.split(" "), [newx, depth + 1]]);
                                if (courses[department]) {
                                    if (courses[department][number]) {
                                        ++i;
                                    }
                                }
                            }
                        }
                    }
                }
                if (courses[department][number].coreqs) {
                    let reqlen = 0;
                    for (const coreqs of courses[department][number].coreqs) {
                        for (const coreq of coreqs) {
                            const [department, number] = coreq.split(' ');
                            if (courses[department]) {
                                if (courses[department][number]) {
                                    ++reqlen;
                                }
                            }
                        }
                    }
                    let i = 0;
                    for (const coreqs of courses[department][number].coreqs) {
                        const color = random_color();
                        for (const coreq of coreqs) {
                            const [department, number] = coreq.split(' ');
                            let e = new Edge(code, coreq, color, "coreq");
                            graph.addEdge(e);
                            if (!explored.has(coreq)) {
                                explored.add(coreq);
                                let newx = Math.min(Math.max(x +
                                    (i - reqlen / 2) * (window.innerWidth) / reqlen, 0), window.innerWidth - card.width);
                                stack.push([coreq.split(" "), [newx, depth + 1]]);
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
    const graph = new Graph(document.querySelector('main'));
    const search_input = document.querySelector("#search");
    const search_bar = document.querySelector("#search_bar");
    const delete_button = document.querySelector("#delete_button");
    search_bar.addEventListener("focusin", () => {
        search_bar.classList.add("mdc-elevation--z4");
    });
    search_bar.addEventListener("focusout", () => {
        search_bar.classList.remove("mdc-elevation--z4");
    });
    search_input.addEventListener("change", () => {
        let query = search_input.value.toUpperCase();
        if (!query.includes(" ")) {
            const index = query.search(/\d/);
            query = query.slice(0, index) + " " + query.slice(index);
        }
        if (search(graph, query, data.courses)) {
            search_input.value = "";
            search_input.placeholder = "";
            search_bar.classList.remove("mdc-text-field--invalid");
        }
        else {
            search_bar.classList.add("mdc-text-field--invalid");
        }
    });
    delete_button.addEventListener("click", () => {
        if (graph.size == 0) {
            return;
        }
        if (confirm("Clear all courses?")) {
            graph.clear();
        }
    });
}
main();
//# sourceMappingURL=main.js.map