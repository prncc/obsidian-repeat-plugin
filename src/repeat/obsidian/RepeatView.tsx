import { DateTime } from 'luxon';
import { Component, ItemView, WorkspaceLeaf, MarkdownPreviewView, TFile } from 'obsidian';
import { getAPI, Literal, DataviewApi, DataArray } from 'obsidian-dataview';
import { determineFrontmatterBounds, replaceOrInsertFields } from 'src/frontmatter';
import { getRepeatChoices } from '../choices';
import { parseRepetitionFields } from '../parsers';
import { RepeatChoice, Repetition } from '../repeatTypes';

export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

function getNotesDue(
  dv: DataviewApi | undefined,
): DataArray<Record<string, Literal>> | undefined {
  const now = DateTime.now();
  return dv?.pages()
    .mutate((page: any) => {
      const { repeat, repeat_due_at } = page.file.frontmatter || {};
      if (!repeat) {
        page.repetition = undefined;
        return page;
      }
      page.repetition = parseRepetitionFields(
        repeat,
        repeat_due_at,
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

function getNextDueNote(
  dv: DataviewApi | undefined,
): Record<string, Literal> | undefined {
  const page = getNotesDue(dv)?.first();
  if (!page) { return; }
  return page;
}

class RepeatView extends ItemView {
  root: Element;
  component: Component;
  messageContainer: HTMLElement;
  buttonsContainer: HTMLElement;
  previewContainer: HTMLElement;
  indexPromise: Promise<null> | undefined;
  dv: DataviewApi | undefined;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.component = new Component();

    this.dv = getAPI(this.app);

    this.root = this.containerEl.children[1];
    this.messageContainer = this.root.createEl('div', { cls: 'repeat-message' });
    this.buttonsContainer = this.root.createEl('div', { cls: 'repeat-buttons' });
    this.previewContainer = this.root.createEl('div', { cls: 'repeat-embedded_note' });
    this.indexPromise = new Promise((resolve, reject) => {
      if (!this.dv) {
        return reject(null);
      }
      // @ts-ignore: event is added by DataView.
      this.app.metadataCache.on('dataview:index-ready', async () => {
        resolve(null);
      });
      if (this.dv.index.initialized) {
        resolve(null);
      }
    });

    this.addRepeatButton = this.addRepeatButton.bind(this);
    this.setPage = this.setPage.bind(this);
    this.resetContainers = this.resetContainers.bind(this);
  }

  getViewType() {
    return REPEATING_NOTES_DUE_VIEW;
  }

  getDisplayText() {
    return 'Repeat';
  }

  async onOpen() {
    if (!this.dv) {
      this.messageContainer.setText(
        'Repeat Plugin requires DataView Plugin to work. ' +
        'Make sure that the DataView Plugin is installed and enabled.'
      )
      return;
    }
    this.setPage();
  }

  async setPage() {
    await this.indexPromise;
    const page = getNextDueNote(this.dv);
    if (!page) {
      this.messageContainer.setText('All done for now!');
      return;
    }
    const dueFilePath = (page?.file as any).path;
    const choices = getRepeatChoices(page.repetition as any);
    const matchingMarkdowns = this.app.vault.getMarkdownFiles()
      .filter((file) => file?.path === dueFilePath);
    if (!matchingMarkdowns) {
      this.messageContainer.setText(
        `Error: Could not find due note ${dueFilePath}. ` +
        'Reopen this view to retry.');
      return;
    }
    const file = matchingMarkdowns[0];
    choices.forEach(choice => this.addRepeatButton(choice, file));
    const markdown = await this.app.vault.cachedRead(file);
    const delimitedFrontmatterBounds = determineFrontmatterBounds(markdown, true);
    await MarkdownPreviewView.renderMarkdown(
      markdown.slice(delimitedFrontmatterBounds ?
                     delimitedFrontmatterBounds[1] : 0),
      this.previewContainer,
      file.path,
      this.component,
    );
  }

  resetContainers() {
    this.buttonsContainer.setText('');
    this.buttonsContainer.innerHTML = '';
    this.previewContainer.innerHTML = '';
  }

  async addRepeatButton(
    choice: RepeatChoice,
    file: TFile,
  ) {
    let button = this.buttonsContainer.createEl('button', {
        text: choice.text,
      },
      (buttonElement) => {
        buttonElement.onclick = async () => {
          this.resetContainers();
          const markdown = await this.app.vault.read(file);
          const newMarkdown = replaceOrInsertFields(markdown, {
            'repeat_due_at': DateTime.now().plus({ year: 1 }).toISO(),
          });
          let resolver: (...data: any) => any;
          new Promise((resolve) => {
            // Keep a reference so that we can properly unsubscribe from the event.
            resolver = (_, eventFile, __) => {
              if (eventFile?.path === file.path) {
                resolve(null);
              }
            };
            // Subscribe to metadata change and resolve when this file updates.
            this.registerEvent(
              // @ts-ignore: event is added by DataView.
              this.app.metadataCache.on('dataview:metadata-change', resolver));
            this.app.vault.modify(file, newMarkdown);
            // Resolve no matter what to avoid getting stuck.
            setTimeout(resolve, 100);
          }).then(() => {
            this.app.metadataCache.off('dataview:metadata-change', resolver);
            // Metadata should be updated, so we can query for next due note.
            this.setPage();
          });
        }
      });
    return button;
  }
}

export default RepeatView;
