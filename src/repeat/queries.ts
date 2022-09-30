import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { parseRepetitionFields } from './parsers';

export function getNotesDue(
  dv: DataviewApi | undefined,
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
      return repetition.repeatDueAt <= now;
    })
    .sort(({ repeatDueAt }) => repeatDueAt, 'asc')
}

export function getNextDueNote(
  dv: DataviewApi | undefined,
): Record<string, Literal> | undefined {
  const page = getNotesDue(dv)?.first();
  if (!page) { return; }
  return page;
}
