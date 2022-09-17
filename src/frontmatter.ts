export type Bounds = [number, number] | null;


/**
 * Determines start and end indexes of the frontmatter, excluding delimiters.
 *
 * The content between these bounds is the frontmatter _candidate_: the
 * captured content might be invalid and unparsable. This function tries
 * to capture the frontmatter bounds in the same way as they're captured
 * when loaded into metadataCache. What Obsidian actually captures into
 * metadataCache can differ from what the editor highlights as the frontmatter.
 *
 * @param content A note's full markdown content.
 * @returns Frontmatter bounds or null if they can't be found.
 */
export function determineFrontmatterBounds(content: string): Bounds {
  // metadataCache's frontmatter only gets populated if *document* starts
  // with ---<newline>, even though the editor allows newlines before ---.
  let openRegex = /---\r?\n/gm;
  // The editor sometimes highlights past the first close, but any fields
  // there are not saved into metadataCache, so we ignore them.
  // It also looks like more than three dashes close the frontmatter, too.
  let closeRegex = /-{3,}(\s|$)/gm;

  const openResult = openRegex.exec(content);
  // Opening must be at the start of the file.
  if (openResult?.index !== 0) {
    return null;
  }

  // Figure out the start point of the YAML in content.
  let startIndex = 4;
  if (openResult[0].includes('\r')) {
    startIndex = 5;
  }

  // Find the closing delimiter after the frontmatter starts.
  closeRegex.lastIndex = startIndex;
  const closeResult = closeRegex.exec(content);
  if (!closeResult) {
    return null;
  }

  return [startIndex, closeResult.index];
}

/**
 * Determines start and end indexes of a specific field in the frontmatter, excluding delimiters.
  *
 * @param frontmatter YAML frontmatter.
 * @param field The name of the field to get bounds for.
 * @returns Field bounds (including the value) or null if they can't be found.
 */
export function determineInlineFieldBounds(frontmatter: string, field: string): Bounds {
  const fieldRegex = new RegExp(`${field}\\s*:\\s*.*(?=\\r?\\n)`, 'gm');
  let fieldResult;
  let lastMatch;  // Later occurrences overwrite previous ones.
  while((fieldResult = fieldRegex.exec(frontmatter))) {
    lastMatch = fieldResult;
  }
  if (!lastMatch) {
    return null;
  }
  return [lastMatch.index, lastMatch.index + lastMatch[0].length];
}
