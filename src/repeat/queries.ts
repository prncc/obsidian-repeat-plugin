import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { parseRepetitionFields } from './parsers';

export function getNotesDue(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
): DataArray<Record<string, Literal>> | undefined {
  const now = DateTime.now();
  return dv?.pages()
    .mutate((page: any) => {
      const { repeat, due_at } = page.file.frontmatter || {};
      if (!repeat) {
        page.repetition = undefined;
        return page;
      }
      page.repetition = parseRepetitionFields(
        repeat,
        due_at,
        page.file.ctime);
      return page;
    })
    .where((page: any) => {
      const { repetition } = page;
      if (!repetition) {
        return false;
      }
      if (page.file.folder.startsWith(ignoreFolderPath)) {
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
): Record<string, Literal> | undefined {
  const page = getNotesDue(dv, ignoreFolderPath)?.first();
  if (!page) { return; }
  return page;
}
