import { Component, ItemView, WorkspaceLeaf, MarkdownPreviewView, TFile } from 'obsidian';
import { getAPI, DataviewApi } from 'obsidian-dataview';

import { determineFrontmatterBounds, replaceOrInsertFields } from '../../frontmatter';
import { getRepeatChoices } from '../choices';
import { RepeatChoice } from '../repeatTypes';
import { getNextDueNote } from '../queries';
import { serializeRepetition } from '../serializers';

export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

class RepeatView extends ItemView {
  root: Element;
  component: Component;
  messageContainer: HTMLElement;
  buttonsContainer: HTMLElement;
  previewContainer: HTMLElement;
  indexPromise: Promise<null> | undefined;
  dv: DataviewApi | undefined;

  icon: string = 'clock';

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
      this.registerEvent(
        // @ts-ignore: event is added by DataView.
          this.app.metadataCache.on('dataview:index-ready', async () => {
          resolve(null);
        })
      );
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
          if (!choice.nextRepetition) {
            // TODO: Handle case of null nextRepetition properly.
            this.setPage();
            return;
          }
          const markdown = await this.app.vault.read(file);
          const newMarkdown = replaceOrInsertFields(
            markdown, serializeRepetition(choice.nextRepetition));
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
