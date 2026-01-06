import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { isRepeatDisabled, formRepetition, parseRepetitionFields } from './parsers';

export interface TagStats {
  tag: string;
  count: number;
}

export function getNotesDue(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  enqueueNonRepeatingNotes?: boolean,
  defaultRepeat?: any,
  filterQuery?: string,
): DataArray<Record<string, Literal>> | undefined {
  const now = DateTime.now();
  // If filterQuery provided, pass it to dv.pages() as a FROM expression
  return dv?.pages(filterQuery || undefined)
    .mutate((page: any) => {
      const { repeat, due_at, hidden } = page.file.frontmatter || {};
      if (isRepeatDisabled(repeat)) {
        page.repetition = undefined;
        return page;
      }
      else if (!repeat) {
        if (enqueueNonRepeatingNotes) {
          page.repetition = formRepetition(
            defaultRepeat,
            undefined,
            undefined,
            page.file.ctime,
            true,
          );
          return page;
        } else {
          page.repetition = undefined;
          return page;
        }
      } else {
        page.repetition = parseRepetitionFields(
          repeat,
          due_at,
          hidden,
          page.file.ctime);
        return page;
      }
    })
    .where((page: any) => {
      const { repetition } = page;
      if (!repetition) {
        return false;
      }
      else if (ignoreFolderPath && page.file.folder.startsWith(ignoreFolderPath)) {
        return false;
      }
      else if (ignoreFilePath && (page.file.path === ignoreFilePath)) {
        return false;
      }
      else {
        return repetition.repeatDueAt <= now;
      }
    })
    .sort((page: any) => {
      return [page.repetition.virtual ? 1 : 0, page.repetition.repeatDueAt];
    }, 'asc')
}

export function getNextDueNote(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  enqueueNonRepeatingNotes?: boolean,
  defaultRepeat?: any,
  filterQuery?: string,
): Record<string, Literal> | undefined {
  const page = getNotesDue(dv, ignoreFolderPath, ignoreFilePath, enqueueNonRepeatingNotes, defaultRepeat, filterQuery)?.first();
  if (!page) { return; }
  return page;
}

/**
 * Get all unique tags from due notes with their counts.
 * This queries all due notes (without filter) to populate the tag shortcuts UI.
 */
export function getTagsFromDueNotes(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  enqueueNonRepeatingNotes?: boolean,
  defaultRepeat?: any,
): TagStats[] | undefined {
  const dueNotes = getNotesDue(
    dv, ignoreFolderPath, ignoreFilePath,
    enqueueNonRepeatingNotes, defaultRepeat
    // Note: no filterQuery here - we want all due notes to get all available tags
  );

  if (!dueNotes) return undefined;

  const tagCounts = new Map<string, number>();

  dueNotes.forEach((page: any) => {
    // page.file.etags contains explicit tags only (not expanded subtags)
    const tags = page.file.etags?.values || [];
    tags.forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  // Convert to sorted array (descending by count, then alphabetically)
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });
}
