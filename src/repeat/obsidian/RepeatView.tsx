import { DateTime } from 'luxon';
import { Component, ItemView, WorkspaceLeaf, MarkdownPreviewView, TFile } from 'obsidian';
import { getAPI, Literal, DataviewApi } from 'obsidian-dataview';
import { determineFrontmatterBounds, replaceOrInsertField } from 'src/frontmatter';
import { getRepeatChoices } from '../choices';
import { parseRepetitionFields } from '../parsing';
import { RepeatChoice } from '../repeatTypes';

export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

function isNoteDue(repeatDueAt: Literal | string | undefined): boolean {
  if (!repeatDueAt) {
    return false;
  }
  return repeatDueAt <= DateTime.now();
}

function getNextDueNote(
  dv: DataviewApi | undefined,
): Record<string, Literal> | undefined {
  const page = dv?.pages()
    .where(({ repeat_due_at }) => isNoteDue(repeat_due_at))
    .sort(({ repeat_due_at }) => repeat_due_at, 'asc')
    .first();
  if (!page) { return; }
  return page;
}

class RepeatView extends ItemView {
  root: Element;
  component: Component;
  messageContainer: HTMLElement;
  buttonsContainer: HTMLElement;
  previewContainer: HTMLElement;
  loaded: boolean;
  dv: DataviewApi | undefined;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.component = new Component();

    this.dv = getAPI(this.app);

    this.root = this.containerEl.children[1];
    this.messageContainer = this.root.createDiv();
    this.buttonsContainer = this.root.createDiv();
    this.previewContainer = this.root.createEl('div', { cls: 'repeat-embedded_note' });
    this.loaded = false;

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
        'Make sure it is installed and enabled.'
      )
      return;
    }
    this.registerEvent(
      // @ts-ignore: event is added by DataView.
      app?.metadataCache.on('dataview:index-ready', async () => {
        if (!this.loaded) {
          this.setPage();
        }
      })
    );
    if (this.dv?.index.initialized && !this.loaded) {
      this.setPage();
    }
  }

  async setPage() {
    const page = getNextDueNote(this.dv);
    if (!page) {
      this.messageContainer.setText('All done for now!');
      this.loaded = true;
      return;
    }
    const dueFilePath = (page?.file as any).path;
    const repetition = parseRepetitionFields(
      (page.repeat || '') as string, page.repeat_due_at as string);
    const choices = getRepeatChoices(repetition);

    const matchingMarkdowns = this.app.vault.getMarkdownFiles()
      .filter((file) => file?.path === dueFilePath);
    if (!matchingMarkdowns) {
      this.messageContainer.setText(
        `Error: Could not find due note ${dueFilePath}. ` +
        'Reopen this view to retry and please report any bugs.');
      this.loaded = true;
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
    this.loaded = true;
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
        buttonElement.onclick = async (event) => {
          this.resetContainers();
          const originalMarkdown = await this.app.vault.read(file);
          const bounds = determineFrontmatterBounds(originalMarkdown);
          if (!bounds) {
            throw Error('Could not find frontmatter in note.')
          }
          let frontmatter = originalMarkdown.slice(...bounds);
          frontmatter = replaceOrInsertField(
            frontmatter, 'repeat_due_at',
            DateTime.now().plus({ year: 1 }).toISO()
          );
          const newContent = [
            originalMarkdown.slice(0, bounds[0]),
            frontmatter,
            originalMarkdown.slice(bounds[1])
          ].join('');
          let resolver;
          new Promise((resolve) => {
            // Keep a reference so that we can properly unsubscribe from the event.
            resolver = (_, eventFile, __) => {
              if (eventFile?.path === file.path) {
                resolve(null);
              }
            };
            this.registerEvent(
              // @ts-ignore: event is added by DataView.
              this.app.metadataCache.on('dataview:metadata-change', resolver));
            this.app.vault.modify(file, newContent);
            // Resolve no matter what to avoid getting stuck.
            setTimeout(resolve, 100);
          }).then(() => {
            this.setPage();
            this.app.metadataCache.off('dataview:metadata-change', resolver);
          });
        }
      });
    return button;
  }
}

export default RepeatView;
