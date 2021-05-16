export interface University {
  name: string;
  url: string;
  base_url: string;
  courses: {
    [subject: string]: {
      [number: string]: Course;
    };
  };
}

export interface Subject {
  [subject: string]: {
    [number: string]: Course;
  };
}

export interface Course {
  name: string;
  prereqs?: string[][];
  coreqs?: string[][];
}
