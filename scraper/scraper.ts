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
  prereqs?: string[][];
  coreqs?: string[][];
}

/**
 * Launches a puppeteer browser.
 * @return Puppeteer browser.
 */
async function launch() {
  let browser: puppeteer.Browser;
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      headless: true,
      args: [],
      ignoreHTTPSErrors: false,
    });
  } catch (error) {
    console.error("Could not create a browser instance: ", error);
  }
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
  await page.waitForSelector("div.content ul > li > a");
  const urls = await page.$$eval("div.content ul > li > a", (links) => {
    return links.map((element) => {
      if (element instanceof HTMLAnchorElement) {
        return element.href;
      }
    });
  });
  await page.close();
  return urls;
}

/**
 * Scrapes course data from course catalogue.
 * @param browser browser instance
 * @param url subject catalogue URL
 * @return array of course catalogue URLs
 */
async function scrape_courses(browser: puppeteer.Browser, url: string) {
  const page = await browser.newPage();
  console.log(`Scraping ${url}`);
  await page.goto(url);
  await page.waitForSelector("div.card-body > div:last-child");

  const courses = {};

  const cards = await page.$$eval("div.card-body > div:last-child", (cards) => {
    /**
     * Parses course requisites
     * @param requisites_text raw requisites text from website
     * @return array of parsed course requisites
     */
    function parse_requisites(requisites_text: string) {
      let reqs = [];
      let prev = "";
      for (let branch of requisites_text.split(/and |; /)) {
        branch = branch.trim().replace(/[Oo]ne of/, "");
        let codes = branch.split(/,|or/).map((v) => v.trim());
        let set = [];
        for (let code of codes) {
          code = code.trim();
          if (code.length) {
            if (/[a-zA-Z]/.test(code[0])) {
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

    return cards.map((card) => {
      // parse title for subject, course code, and course name
      const h4 = card.querySelector("h4").childNodes[0].textContent.trim();
      const [code, name] = h4.split(" - ");

      const parts = code.split(" ");
      const subject = parts[0];
      const number = parts[parts.length - 1];

      const data: Course = {
        name: name
      };

      const p = card.querySelector("div > p:last-child");
      if (p) {
        // parse course requisites
        const prereq_regex = /Prerequisites*:* (.+?)(?:\.)/;
        const prereqtext = p.textContent.match(prereq_regex);
        if (prereqtext) {
          data.prereqs = parse_requisites(prereqtext[1]);
        }

        const coreq_regex = /Corequisites*:* (.+?)(?:\.)/;
        const coreqtext = p.textContent.match(coreq_regex);
        if (coreqtext) {
          data.coreqs = parse_requisites(coreqtext[1]);
        }
      }

      return {
        subject: subject,
        number: number,
        data: data,
      };
    });
  });

  await page.close();

  for (const card of cards) {
    if (!courses[card.subject]) {
      courses[card.subject] = {};
    }
    courses[card.subject][card.number] = card.data;
  }

  return courses;
}

/**
 * Launch browser and scrape courses
 */
async function main() {
  const COURSE_CATALOGUE = "https://apps.ualberta.ca/catalogue/course";
  const PATH = "data/ualberta.ca.json";
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

    await browser.close();
  } catch (error) {
    console.error(error);
    return;
  }

  // Save data to file
  fs.writeFile(
    PATH,
    JSON.stringify(DATA),
    "utf8",
    function (error) {
      if (error) {
        console.error(error);
        return;
      }
      console.log(`The data has been saved successfully to ${PATH}!`);
    },
  );
}

main();
