/* Every quoted string in a source file read as a class list, so a test names the classes a fact
   needs rather than the whole string — a reordered or reflowed list still passes, a dropped class
   does not. */
export const classLists = (source: string) =>
  [...source.matchAll(/"([^"\n]*)"/g)].map((match) => match[1].split(/\s+/));

export const withClasses = (source: string, ...classes: string[]) =>
  classLists(source).filter((list) =>
    classes.every((name) => list.includes(name)),
  );
