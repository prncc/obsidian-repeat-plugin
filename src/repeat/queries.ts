import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { isRepeatDisabled, formRepetition, parseRepetitionFields } from './parsers';

export function getNotesDue(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  enqueueNonRepeatingNotes?: boolean,
  defaultRepeat?: any,
): DataArray<Record<string, Literal>> | undefined {
  const now = DateTime.now();
  return dv?.pages()
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
): Record<string, Literal> | undefined {
  const page = getNotesDue(dv, ignoreFolderPath, ignoreFilePath, enqueueNonRepeatingNotes, defaultRepeat)?.first();
  console.log(page);
  if (!page) { return; }
  return page;
}
