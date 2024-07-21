import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { isRepeatDisabled, parseRepetitionFields } from './parsers';

export function getNotesDue(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
): DataArray<Record<string, Literal>> | undefined {
  const now = DateTime.now();
  return dv?.pages()
    .mutate((page: any) => {
      const { repeat, due_at, hidden } = page.file.frontmatter || {};
      if (!repeat || isRepeatDisabled(repeat)) {
        page.repetition = undefined;
        return page;
      }
      page.repetition = parseRepetitionFields(
        repeat,
        due_at,
        hidden,
        page.file.ctime);
      return page;
    })
    .where((page: any) => {
      const { repetition } = page;
      if (!repetition) {
        return false;
      }
      if (ignoreFolderPath && page.file.folder.startsWith(ignoreFolderPath)) {
        return false;
      }
      if (ignoreFilePath && (page.file.path === ignoreFilePath)) {
        return false;
      }
      return repetition.repeatDueAt <= now;
    })
    .sort((page: any) => {
      return page.repetition.repeatDueAt;
    }, 'asc')
}

export function getNextDueNote(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
): Record<string, Literal> | undefined {
  const page = getNotesDue(dv, ignoreFolderPath, ignoreFilePath)?.first();
  if (!page) { return; }
  return page;
}
