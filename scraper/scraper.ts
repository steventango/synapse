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
  await page.waitForSelector("div.subject-columns > a", {timeout: 5000});
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
  await page.waitForSelector("div.card-body > div:last-child", {timeout: 5000});

  const courses: Subject = {};

  const cards = await page.$$eval(
    "div.card-body > div:last-child",
    parse_courses,
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
    for (let branch of requisites_text.split(/\band\b|; /)) {
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

    const p = card.querySelector("div > p:last-child");
    if (p?.textContent) {
      const text = p.textContent;
      // parse course requisites
      const prereq_regex = /Prerequisites*:* (.+?)(?:\.)/;
      const prereqtext = text.match(prereq_regex);
      if (prereqtext) {
        data.prereqs = parse_requisites(prereqtext[1], subject);
        data.raw = text.substring(prereqtext.index!);
      }

      const coreq_regex = /Corequisites*:* (.+?)(?:\.)/;
      const coreqtext = text.match(coreq_regex);
      if (coreqtext) {
        data.coreqs = parse_requisites(coreqtext[1], subject);
        if (!data.raw) {
          data.raw = text.substring(coreqtext.index!);
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
      const types: ["prereqs", "coreqs"] = ["prereqs", "coreqs"];
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
          "None",
          "other approved course",
          "consent of the Department of Medical Genetics"
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
                errors += `${s} ${c} | ${requisite}\n`;
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
