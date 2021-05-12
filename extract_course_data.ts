function parse_reqs(reqtext: string) {
  let reqs = [];
  for (let branch of reqtext.split(/and |; /)) {
    branch = branch.trim().replace(/[Oo]ne of/, '');
    reqs.push(parse_reqlist(branch));
  }
  return reqs;
}

function parse_reqlist(reqlist: string) {
  let codes = reqlist.split(/,|or/).map(v => v.trim());
  let set = [];
  let prev = "";
  for (let code of codes) {
    code = code.trim();
    if (code.length) {
      if (/[a-zA-Z]/.test(code[0])) {
        prev = code.split(' ')[0];
        set.push(code);
      } else {
        set.push(`${prev} ${code}`);
      }
    }
  }
  return set;
}

const data = JSON.parse(localStorage.getItem('synapse.data') || "{}");

interface Subjects {
  [key: string]: {
    name: string,
    prereqs: string[][],
    coreqs: string[][]
  }
}

const subjects: Subjects = {};
const cards = Array.from(document.querySelectorAll('div.card-body > div:last-child'));
cards.map((card) => {
  const h4 = card.querySelector('h4')!.childNodes[0]!.textContent!.trim();

  const [code, name] = h4.split(' - ');
  const number = code.split(' ')[code.split(' ').length-1];
  subjects[number].name = name;

  const p = card.querySelector('div > p:last-child');

  if (p) {
    const prereqtext = p.textContent!.match(/Prerequisites*: (.+?)(?:\.)/);
    const coreqtext = p.textContent!.match(/Corequisites*: (.+?)(?:\.)/);
    if (prereqtext) {
      subjects[number].prereqs = parse_reqs(prereqtext[1]);
    }
    if (coreqtext) {
      subjects[number].coreqs = parse_reqs(coreqtext[1]);
    }
  }
});

data[location.href.slice(location.href.lastIndexOf('/') + 1).toUpperCase().replace('_', '')] = subjects;

localStorage.setItem('synapse.data', JSON.stringify(data))

// copy(JSON.parse(localStorage.getItem('synapse.data')))
