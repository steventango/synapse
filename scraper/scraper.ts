import * as fs from "fs";
import * as puppeteer from "puppeteer";
import Pool from "./pool";

interface University {
  name: string;
  url: string;
  base_url: string;
  courses: {
    [subject: string]: {
      [number: string]: Course;
    };
  };
}

interface Subject {
  [subject: string]: {
    [number: string]: Course;
  };
}

interface Course {
  name: string;
  desc?: string;
  units?: number;
  approved_hours?: number[];
  fi?: number;
  typically_offered?: string;
  faculty?: string;
  raw?: string;
  prereqs?: string[][];
  coreqs?: string[][];
}

/**
 * Launches a puppeteer browser.
 * @return Puppeteer browser.
 */
async function launch() {
  console.log("Launching browser...");
  const browser: puppeteer.Browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ],
    ignoreHTTPSErrors: false,
  });

  return browser;
}

/**
 * Scrapes for urls to each subject from course catalogue.
 * @param browser browser instance
 * @param url subject catalogue URL
 * @return array of course catalogue URLs
 */
async function scrape_subjects(browser: puppeteer.Browser, url: string) {
  const page = await browser.newPage();
  console.log(`Scraping ${url}`);
  await page.goto(url);
  await page.waitForSelector("div.subject-columns > a", { timeout: 5000 });
  const urls = await page.$$eval("div.subject-columns > a", (links) => {
    return links
      .filter((e): e is HTMLAnchorElement => (e instanceof HTMLAnchorElement))
      .map((e) => e.href);
  });
  await page.close();
  return urls;
}

/**
 * Scrapes course data from subject.
 * @param browser browser instance
 * @param url subject catalogue URL
 * @return array of subject objects
 */
async function scrape_courses(browser: puppeteer.Browser, url: string) {
  const page = await browser.newPage();
  console.log(`Scraping ${url}`);
  await page.goto(url);
  await page.waitForSelector("div.card-body > div:last-child", { timeout: 5000 });

  const courses: Subject = {};

  const cards = await page.$$eval(
    "div.card-body > div:last-child",
    parse_courses,
  );

  const faculty = await page.$eval(
    "body > div > div > p:nth-child(3) > a",
    (e) => e.textContent!,
  );

  await page.close();

  // reformat data into Subject interface
  for (const card of cards) {
    if (card === undefined) {
      continue;
    }
    if (!courses[card.subject]) {
      courses[card.subject] = {};
    }
    card.data.faculty = faculty;
    courses[card.subject][card.number] = card.data;
  }

  return courses;
}

/**
 * Processes courses data from page elements.
 * @param cards page elements
 * @return courses data
 */
function parse_courses(cards: Element[]) {
  /**
   * Parses course requisites
   * @param requisites_text raw requisites text from website
   * @param subject course subject
   * @return array of parsed course requisites
   */
  function parse_requisites(requisites_text: string, subject: string) {
    const generic: {
      [key: string]: string;
    } = {
      "": "ANY",
      "ANTHROPOLOGY": "ANTHR",
      "ART HISTORY": "AUART",
      "BIOLOGICAL SCIENCES": "BIOL",
      "BIOLOGY": "BIOL",
      "COMPUTING SCIENCE": "CMPUT",
      "THE FACULTY OF SCIENCE": "SCIENCE",
    };

    let reqs: string[][] = [];
    let prev = subject;
    for (let branch of requisites_text.split(/\band\b|; /i)) {
      branch = branch.trim().replace(/one of/i, "");
      let codes = branch.split(/,|\bor\b/i).map((v) => v.trim());
      let set: string[] = [];
      for (let code of codes) {
        code = code.trim();
        if (code.length) {
          const generics_1 = code.match(
            /(?:Any|a) (\d{3})-level course in (.*)/i,
          );
          const generics_2 = code.match(/(?:Any|a) (\d{3})-level (.*) course/i);
          if (generics_1 || generics_2) {
            let [_, level, subject] = (generics_1 || generics_2)!;
            if (level) {
              level = level[0] + "XX";
            }
            if (subject) {
              subject = subject.trim().toUpperCase();
            }
            if (subject in generic) {
              subject = generic[subject];
            }
            set.push(`${subject} ${level}`);
          } else if (/[a-zA-Z]/.test(code[0])) {
            prev = code.split(" ")[0];
            set.push(code);
          } else {
            set.push(`${prev} ${code}`);
          }
        }
      }
      reqs.push(set);
    }
    return reqs;
  }

  /**
   * Splits on the rightmost occurence of separator.
   * @param string string to split
   * @param separator characters to split by
   * @returns 2-tuple of split string
   */
  function rsplit(string: string, separator: string = " ") {
    const index = string.lastIndexOf(separator);
    return [string.substring(0, index), string.substring(index + 1)];
  }

  return cards.map((card) => {
    // parse title for subject, course code, and course name
    const node_title = card.querySelector("h2 *:last-child");
    if (!node_title) {
      return;
    }
    const title = node_title.textContent!.trim();
    const [code, name] = title.split(" - ");

    const [subject, number] = rsplit(code);

    const data: Course = {
      name: name,
    };

    const b = card.querySelector("div > b:last-of-type");
    if (b?.textContent) {
      const text = b.textContent;
      const regex = /★ (\d+) \(fi (\d+)\)\(([A-Z]+), (\d+)-(\d+)-(\d+)/
      const match = text.match(regex);
      if (match) {
        const [_, units, fi, typically_offered, a, b, c] = match;
        data.units = parseInt(units);
        data.fi = parseInt(fi);
        data.typically_offered = typically_offered;
        data.approved_hours = [parseInt(a), parseInt(b), parseInt(c)]
      } else {
        console.log(`No match for ${text}`);
      }
    }
    const p = card.querySelector("div > p:last-child");
    if (p?.textContent) {
      const text = p.textContent;
      // parse course requisites
      const prereq_regex = /Prerequisites*:* (?:(?!(?:and\/)*(?:and|or|\/) (?:[Cc]orequisite)s*|for).)+ (.+?)(?:\.)/;
      for (const prereqtext of text.matchAll(prereq_regex)) {
        data.prereqs = parse_requisites(prereqtext[1], subject);
        if (!data.raw) {
          data.raw = text.substring(prereqtext.index!).trim();
        }
      }

      const coreq_regex = /(?:(?:(?:Corequisite|Prerequisite|Pre-*)s* (?:and\/)*(?:and|or|\/) (?:Corequisite|Prerequisite)s*)|(?:Corequisites*)|(?: Pre\/corequisites*)):* (.+?)(?:\.)/i;
      for (const coreqtext of text.matchAll(coreq_regex)) {
        data.coreqs = parse_requisites(coreqtext[1], subject);
        if (!data.raw) {
          data.raw = text.substring(coreqtext.index!).trim();
        }
      }
      data.desc = text.replace(data.raw!, "").trim();
    }

    return {
      subject: subject,
      number: number,
      data: data,
    };
  })
}

/**
 * Logs errors in scraped data to file.
 * @param data scraped data object
 * @param data path to write logs to
 */
async function log_errors(data: University, path: string) {
  let errors = "";
  for (const [s, subject] of Object.entries(data.courses)) {
    for (const [c, course] of Object.entries(subject)) {
      const types: ["prereqs",
        "coreqs"] = ["prereqs",
          "coreqs"];
      const allowed: Set<string> = new Set(
        [
          "consent of instructor",
          "consent of the instructor",
          "by consent of instructor",
          "by consent of the instructor",
          "instructor consent",
          "consent of the instructors",
          "permission of instructor",
          "permission of the instructor",
          "written permission of instructor",
          "written permission of the instructor",
          "consent from the course coordinator",
          "consent from the course coordinators",
          "consent of the associate chair",
          "consent of department",
          "consent of the department",
          "consent of the department chair",
          "department consent",
          "departmental consent",
          "departmental permission",
          "permission of department",
          "permission of the department",
          "with consent of department",
          "with consent of the department",
          "consent of program",
          "consent of program coordinator",
          "consent of the program director",
          "with the consent of the program director(s)",
          "with the permission of the program director",
          "consent of faculty",
          "consent of the faculty",
          "with faculty consent",
          "consent of division",
          "equivalent",
          "equivalents",
          "equivalent knowledge",
          "varies according to topic",
          "based on audition",
          "are determined by the instructor in the course outline",
          "with a sufficient score on the on-line placement test",
          "consent of the instructor(s) based on successful completion of the selection process",
          "consent of the instructors based on successful completion of the selection process",
          "none",
          "other approved course",
          "consent of the department of medical genetics",
          "consent of department based on assessment in the first class",
          "permission from the department based on portfolio review",
          "consent of department based upon audition",
          "consent of department based on audition",
          "substantial conducting experience",
          "based upon audition",
          "aural skills exam for other than bmus students",
          "satisfactory completion of department of music theory placement exam",
          "consent from course coordinator",
          "Consult department",
          "consent of instructor)",
          "a minimum grade of b+ in the prerequisite course is strongly recommended",
          "consent of  instructor",
          "consent of the course coordinator",
          "permission from the instructor",
          "assistant dean",
          "undergraduate program",
          "consent of department chair",
          "depend on the subject",
          "consent of the  instructor (based on portfolio submission)",
          "consent of the selection committee",
          "participation in a 'leadership role' on campus",
          "consent of program adviser",
          "consent of instructor based on audition",
          "consent of the division",
          "consent of the department of biochemistry",
          "consent of instructors for students not registered in the systematics",
          "the consent of the associate chair",
          "consent of  the instructor",
          "consent of the business undergraduate office",
          "consent of faculty of business",
          "restricted to honors computing science students",
          "consent of community service - learning director",
          "instructor",
          "the equivalent",
          "permission from the program office",
          "which may be taken concurrently with permission of the instructor",
          "instructor's consent",
          "consent of supervisor",
          "department",
          "consent of the program",
          "consent of instructors",
          "consent of the associate dean (undergraduate programs)",
          "consent of  department",
          "consent of graduate co-ordinator",
          "with instructor's consent",
          "consent of the program administrator",
          "consent of the instructor (based on portfolio submission)",
          "consent of the instructor based on completion of a csl placement (a record of courses",
          "consent of the instructor based on audition",
          "consent of the instructor(s)",
          "consent of department of biochemistry",
          "consent of the program coordinator",
          "the consent of the course coordinator",
          "registration is by consent of department",
          "consent of the college",
          "consent of college",
          "consent of program director",
          "consent of the graduate student's supervisor",
          "consent of the associate dean",
          "consent (undergraduate programs)",
          "the consent of the instructor",
          "consent of the thesis supervisor",
          "consent of instructor is required",
          "consent of the course instructor",
          "restricted to students who have received consent from torch executive advisory committee",
          "consent of course coordinator",
          "consent of the department based on assessment in the first class",
          "consent of the department based on portfolio review",
          "consent of the department based on audition",
          "consent of the neuroscience",
          "consent of the centre for neuroscience",
          "consent of the department of",
          "consent of the faculty of native studies",
          "the consent of the department",
          "corequisites: consent of the department",
          "consent of the course co-ordinator",
          "consent of the department of physiology",
          "consent of the department of pharmacology",
          "consent of student's graduate supervisor",
          "consent of program [office of interdisciplinary studies]",
          "prerequisite courses vary",
          "depending on topic",
          "vary depending on topic",
          "the course coordinator",
          "the student's supervisor",
          "equivalent)",
          "their equivalents",
          "honors advisor",
          "permission from the mba office",
          "the undergraduate advisor",
          "instructor approval",
          "application to department",
          "approval of the department",
        ],
      );
      for (const type of types) {
        if (type in course) {
          for (const requisites of course[type]!) {
            for (const requisite of requisites) {
              if (/([A-z ]{3,5} [\dX]{3})|([A-z]+ \d{2})/.test(requisite)) {
                continue;
              } else if (allowed.has(requisite.toLowerCase())) {
                continue;
              } else {
                errors += `${s} ${c} | ${requisite.toLowerCase()}\n`;
              }
            }
          }
        }
      }
    }
  }
  fs.writeFile(
    path,
    errors,
    "utf8",
    function (error) {
      if (error) {
        console.error(error);
        return;
      }
      console.log(`The data has been saved successfully to ${path}!`);
    },
  );
}

/**
 * Launch browser and scrape courses
 */
async function main() {
  const COURSE_CATALOGUE = "https://apps.ualberta.ca/catalogue/course";
  const DATA_PATH = "data/ualberta.ca.json";
  const LOG_PATH = "log.txt";
  const MAX_CONCURRENCY = 10;
  const POOL = new Pool<Subject>(MAX_CONCURRENCY);

  const DATA: University = {
    name: "University of Alberta",
    url: "https://apps.ualberta.ca/catalogue/",
    base_url: "https://apps.ualberta.ca/catalogue/course/",
    courses: {},
  };

  try {
    const browser = await launch();
    const subjects = await scrape_subjects(browser, COURSE_CATALOGUE);
    const promises: Promise<Subject>[] = [];

    for (const subject of subjects) {
      promises.push(POOL.add(() => scrape_courses(browser, subject)));
    }

    const courses = await Promise.all(promises);
    console.log(`The data has been scraped successfully`);
    for (const course of courses) {
      Object.assign(DATA.courses, course);
    }

    await log_errors(DATA, LOG_PATH);

    await browser.close();
  } catch (error) {
    console.error(error);
    return;
  }

  // Save data to file
  fs.writeFile(
    DATA_PATH,
    JSON.stringify(DATA),
    "utf8",
    function (error) {
      if (error) {
        console.error(error);
        return;
      }
      console.log(`The data has been saved successfully to ${DATA_PATH}!`);
    },
  );
}

main();
