import Graph, { Edge, Vertex } from "./graph.js";
import { random_color, rsplit } from "./util.js";
const card = {
    width: 128,
    height: 72,
};
async function load() {
    const url = "//raw.githubusercontent.com/steventango/synapse/master/data/" +
        "ualberta.ca.json";
    const response = await fetch(url);
    return response.json();
}
function search(graph, code, courses) {
    const explored = new Set();
    const stack = [];
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
        if (courses[department]) {
            const course = courses[department][number];
            if (course) {
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
                                let newx = Math.min(Math.max(x +
                                    (i - reqlen / 2) * (card.width + 8), 160 * Math.random()), window.innerWidth - card.width - 160 * Math.random());
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
                                let newx = Math.min(Math.max(x +
                                    (i - reqlen / 2) * (window.innerWidth) / reqlen, 0), window.innerWidth - card.width);
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
    const main = document.querySelector("main");
    const graph_element = document.querySelector("#graph");
    const graph = new Graph(graph_element);
    const search_input = document.querySelector("#search");
    const search_bar = document.querySelector("#search_bar");
    const error_notice = document.querySelector(".error");
    const delete_button = document.querySelector("#delete_button");
    const iconToggle = new mdc.iconButton.MDCIconButtonToggle(document.querySelector("#toggle_theme"));
    const snackbar = document.querySelector(".mdc-snackbar");
    const snackbar_text = document.querySelector(".mdc-snackbar__label");
    search_bar.addEventListener("focusin", () => {
        search_bar.classList.add("mdc-elevation--z4");
    });
    search_bar.addEventListener("focusout", () => {
        search_bar.classList.remove("mdc-elevation--z4");
    });
    search_input.addEventListener("change", () => {
        let query = search_input.value.toUpperCase();
        query = query.trim();
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
    graph_element.addEventListener("graph:change", () => {
        if (graph.size) {
            delete_button.style.display = "inline";
        }
        else {
            delete_button.style.display = "none";
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
    iconToggle.listen("MDCIconButtonToggle:change", (e) => {
        if (e.detail.isOn) {
            document.body.classList.add("dark");
        }
        else {
            document.body.classList.remove("dark");
        }
    });
}
main();
//# sourceMappingURL=main.js.map