import Graph from "./graph";
import search from "./search"
import { University } from "./university";
import { MDCDialog } from "@material/dialog";
import { MDCIconButtonToggle } from "@material/icon-button";
import { MDCSnackbar } from "@material/snackbar";
import { MDCTextField } from "@material/textfield";

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

async function main() {
  const iconToggle = new MDCIconButtonToggle(
    document.querySelector("#toggle_theme")!,
  );

  // local storage dark or light
  const themeState: string | null = localStorage.getItem("synapse.theme");
  if (themeState === null) {
    // set to light by default
    localStorage.setItem("synapse.theme", "light");
  } else if (themeState == "dark") {
    document.body.classList.add("dark");
    iconToggle.on = true;
  }

  window.setTimeout(() => {
    document.body.classList.add('transition');
  }, 1000);

  const data = await load();
  const graph_element: HTMLElement = document.querySelector(
    "#graph",
  )!;

  const graph: Graph = new Graph(graph_element);

  const search_bar = new MDCTextField(document.querySelector("#search_bar")!);

  const delete_button: HTMLButtonElement = document.querySelector(
    "#delete_button",
  )!;

  const snackbar = new MDCSnackbar(document.querySelector("#snackbar")!);
  const dialog = new MDCDialog(document.querySelector(".mdc-dialog")!);

  search_bar.root.addEventListener("focusin", () => {
    search_bar.root.classList.add("mdc-elevation--z4");
  });

  search_bar.root.addEventListener("focusout", () => {
    search_bar.root.classList.remove("mdc-elevation--z4");
  });

  search_bar.root.addEventListener("change", () => {
    let query = search_bar.value.toUpperCase();
    query = query.trim();
    // if already in graph, give a notice
    if (query.length) {
      if (!query.includes(" ")) {
        const index = query.search(/\d/);
        query = query.slice(0, index) + " " + query.slice(index);
      }
      if (graph.isFound(query)) {
        search_bar.root.classList.add("mdc-text-field--invalid");
        snackbar.labelText = "Course is already in graph";
        snackbar.open();
        return;
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
      delete_button.style.opacity = "1";
    } else {
      delete_button.style.opacity = "0";
    }
  });

  delete_button.addEventListener("click", () => {
    // if nothing to delete, do not display message
    if (graph.size === 0) {
      return;
    }
    dialog.open();
  });

  iconToggle.listen<CustomEvent<{ isOn: boolean }>>(
    "MDCIconButtonToggle:change",
    (event) => {
      if (event.detail.isOn) {
        document.body.classList.add("dark");
        localStorage.setItem("synapse.theme", "dark");
      } else {
        document.body.classList.remove("dark");
        localStorage.setItem("synapse.theme", "light");
      }
    },
  );


  dialog.listen<CustomEvent<{action: string}>>("MDCDialog:closing",
  (event) => {
    if (event.detail.action === "discard") {
      graph.clear();
    }
  });
}

main();
