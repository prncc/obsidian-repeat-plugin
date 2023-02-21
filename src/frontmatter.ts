export type Bounds = [number, number] | null;


/**
 * Determines start and end indexes of the frontmatter.
 *
 * The content between these bounds is the frontmatter _candidate_: the
 * captured content might be invalid and unparsable. This function tries
 * to capture the frontmatter bounds in the same way as they're captured
 * when loaded into metadataCache. What Obsidian actually captures into
 * metadataCache can differ from what the editor highlights as the frontmatter.
 *
 * Example demonstrating newline behavior:
 * `---
 * one: 1
 * two: 2
 * ---`
 * ->
 * `one: 1
 * two: 2
 * `
 * when includeDelimiters === false, and
 * `---
 * one: 1
 * two: 2
 * ---`
 * when includeDelimiters === true.
 *
 * @param content A note's full markdown content.
 * @returns Frontmatter bounds or null if they can't be found.
 */
export function determineFrontmatterBounds(
  content: string,
  includeDelimiters = false,
): Bounds {
  // metadataCache's frontmatter only gets populated if *document* starts
  // with ---<newline>, even though the editor allows newlines before ---.
  const openRegex = /---\r?\n/gm;
  // The editor sometimes highlights past the first close, but any fields
  // there are not saved into metadataCache, so we ignore them.
  // It also looks like more than three dashes close the frontmatter, too.
  const closeRegex = /-{3,}(\s|$)/gm;

  const openResult = openRegex.exec(content);
  // Opening must be at the start of the file.
  if (openResult?.index !== 0) {
    return null;
  }

  // Figure out the start point of the YAML in content.
  let frontmatterStartIndex = 4;
  if (openResult[0].includes('\r')) {
    frontmatterStartIndex = 5;
  }

  // Find the closing delimiter after the frontmatter starts.
  closeRegex.lastIndex = frontmatterStartIndex;
  const closeResult = closeRegex.exec(content);
  if (!closeResult) {
    return null;
  }

  const startIndex = includeDelimiters ? 0 : frontmatterStartIndex;
  const closeIndex = includeDelimiters ? closeRegex.lastIndex : closeResult.index;
  return [startIndex, closeIndex];
}

/**
 * Determines start and end indexes of a specific field in the frontmatter, excluding delimiters.
 *
 * @param frontmatter YAML frontmatter (starting newline: no; ending newline: yes).
 * @param field The name of the field to get bounds for.
 * @returns Field bounds (including the value) or null if they can't be found.
 */
export function determineInlineFieldBounds(frontmatter: string, field: string): Bounds {
  const fieldRegex = new RegExp(`^${field}\\s*:\\s*.*(?=\\r?\\n)`, 'gm');
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

/**
 * Adds or replaces a specific field: value.
 *
 * @param frontmatter YAML frontmatter (starting newline: no; ending newline: yes).
 * @param field The name of the field to replace or insert.
 * @param value The value to replace or insert.
 * @returns New YAML frontmatter with the required modification.
 */
export function replaceOrInsertField(frontmatter: string, field: string, value: string): string {
  let bounds = determineInlineFieldBounds(frontmatter, field);
  if (!bounds) {
    bounds = [frontmatter.length, frontmatter.length];
  }
  const prefix = frontmatter.slice(0, bounds[0]);
  const suffix = frontmatter.slice(bounds[1]);
  return [
    prefix, // Prefix contains newlines from previous field.
    `${field}: ${value}`,
    suffix || '\n', // Add newline only if this is the last field.
  ].join('')
}


/**
 * Replaces serialized repetition fields in the content's YAML frontmatter.
 * @param content Content whose frontend to update.
 * @param serializedRepetition Object mapping field names to values.
 * @returns Content with updated frontmatter.
 */
export function updateRepetitionMetadata(
  content: string,
  serializedRepetition: object,
): string {
  let newContent = content;
  let bounds = determineFrontmatterBounds(newContent);
  if (!bounds) {
    // Add new frontmatter and update bounds.
    const newFrontmatter = '---\n---\n';
    newContent = [
      newFrontmatter,
      content,
    ].join('');
    bounds = determineFrontmatterBounds(newContent);
    if (!bounds) {
      throw Error('Failed to create frontmatter in note.');
    }
  }
  let frontmatter = content.slice(...bounds);
  for (const field in fieldToValue) {
    frontmatter = replaceOrInsertField(frontmatter, field, fieldToValue[field]);
  }
  return [
    newContent.slice(0, bounds[0]),
    frontmatter,
    newContent.slice(bounds[1]),
  ].join('');
}
