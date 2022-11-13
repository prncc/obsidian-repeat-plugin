import { Component, ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { getAPI, DataviewApi } from 'obsidian-dataview';

import { determineFrontmatterBounds, replaceOrInsertFields } from '../../frontmatter';
import { getRepeatChoices } from '../choices';
import { RepeatChoice } from '../repeatTypes';
import { getNextDueNote } from '../queries';
import { serializeRepetition } from '../serializers';
import { renderMarkdown, renderTitleElement } from 'src/markdown';

export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

class RepeatView extends ItemView {
  buttonsContainer: HTMLElement;
  component: Component;
  currentDueFilePath: string | undefined;
  dv: DataviewApi | undefined;
  icon = 'clock';
  indexPromise: Promise<null> | undefined;
  messageContainer: HTMLElement;
  previewContainer: HTMLElement;
  root: Element;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.addRepeatButton = this.addRepeatButton.bind(this);
    this.disableExternalHandlers = this.disableExternalHandlers.bind(this);
    this.enableExternalHandlers = this.enableExternalHandlers.bind(this);
    this.handleExternalModifyOrDelete = (
      this.handleExternalModifyOrDelete.bind(this));
    this.handleExternalRename = this.handleExternalRename.bind(this);
    this.promiseMetadataChangeOrTimeOut = (
      this.promiseMetadataChangeOrTimeOut.bind(this));
    this.setMessage = this.setMessage.bind(this);
    this.setPage = this.setPage.bind(this);
    this.resetContainers = this.resetContainers.bind(this);

    this.component = new Component();

    this.dv = getAPI(this.app);

    this.root = this.containerEl.children[1];
    this.indexPromise = new Promise((resolve, reject) => {
      const resolver = () => resolve(null);
      if (!this.dv) {
        return reject(null);
      }
      this.registerEvent(
        // @ts-ignore: event is added by DataView.
        this.app.metadataCache.on('dataview:index-ready', resolver));
      if (this.dv.index.initialized) {
        // Not invoked on initial open if the index is loading.
        this.app.metadataCache.off('dataview:index-ready', resolver);
        resolve(null);
      }
    });

    this.resetContainers();
    this.setMessage('Loading...');
  }

  getViewType() {
    return REPEATING_NOTES_DUE_VIEW;
  }

  getDisplayText() {
    return 'Repeat';
  }

  async onOpen() {
    if (!this.dv) {
      this.setMessage(
        'Repeat Plugin requires DataView Plugin to work. ' +
        'Make sure that the DataView Plugin is installed and enabled.'
      );
      return;
    }
    this.enableExternalHandlers();
    this.setPage();
  }

  async onClose() {
    this.disableExternalHandlers();
  }

  enableExternalHandlers() {
    this.registerEvent(
      this.app.vault.on('modify', this.handleExternalModifyOrDelete));
    this.registerEvent(
      this.app.vault.on('delete', this.handleExternalModifyOrDelete));
    this.registerEvent(
      this.app.vault.on('rename', this.handleExternalRename));
  }

  disableExternalHandlers () {
    this.app.vault.off('modify', this.handleExternalModifyOrDelete);
    this.app.vault.off('delete', this.handleExternalModifyOrDelete);
    this.app.vault.off('rename', this.handleExternalRename);
  }

  async promiseMetadataChangeOrTimeOut() {
    let resolveRef: (...data: any) => any;
    return new Promise((resolve) => {
      resolveRef = resolve;
      this.registerEvent(
        // @ts-ignore: event is added by DataView.
        this.app.metadataCache.on('dataview:metadata-change', resolveRef));
      setTimeout(resolveRef, 100);
    }).then(() => {
      this.app.metadataCache.off('dataview:metadata-change', resolveRef);
    });
  }

  async handleExternalModifyOrDelete(file: TFile) {
    // Current note might be swapped if user edits it to be due later.
    // However, this shouldn't happen when *other* notes are edited.
    if (file.path === this.currentDueFilePath) {
      await this.promiseMetadataChangeOrTimeOut();
      this.resetContainers();
      this.setPage();
    }
  }

  async handleExternalRename(file: TFile, oldFilePath: string) {
    // This only has to handle renames of this file because automatically
    // updated embedded links emit their own modify event.
    if (oldFilePath === this.currentDueFilePath) {
      await this.promiseMetadataChangeOrTimeOut();
      this.resetContainers();
      this.setPage();
    }
  }

  async setPage() {
    await this.indexPromise;
    // Reset the message container so that loading message is hidden.
    this.setMessage('');
    this.messageContainer.style.display = 'none';
    const page = getNextDueNote(this.dv);
    if (!page) {
      this.setMessage('All done for now!');
      return;
    }
    const dueFilePath = (page?.file as any).path;
    this.currentDueFilePath = dueFilePath;
    const choices = getRepeatChoices(page.repetition as any);
    const matchingMarkdowns = this.app.vault.getMarkdownFiles()
      .filter((file) => file?.path === dueFilePath);
    if (!matchingMarkdowns) {
      this.setMessage(
        `Error: Could not find due note ${dueFilePath}. ` +
        'Reopen this view to retry.');
      return;
    }
    const file = matchingMarkdowns[0];

    // Render the repeat control buttons.
    choices.forEach(choice => this.addRepeatButton(choice, file));

    // .markdown-embed adds borders that shouldn't be while loading,
    // so we only add the class when the note is about to be rendered.
    this.previewContainer.addClass('markdown-embed');

    // Render the title and link that opens note being reviewed.
    renderTitleElement(
      this.previewContainer,
      file,
      this.app.vault);

    // Render the note contents.
    const markdown = await this.app.vault.cachedRead(file);
    const delimitedFrontmatterBounds = determineFrontmatterBounds(markdown, true);
    await renderMarkdown(
      markdown.slice(
        delimitedFrontmatterBounds ? delimitedFrontmatterBounds[1] : 0),
      this.previewContainer,
      file.path,
      this.component,
      this.app.vault);
  }

  resetContainers() {
    this.messageContainer && this.messageContainer.remove();
    this.buttonsContainer && this.buttonsContainer.remove();
    this.previewContainer && this.previewContainer.remove();
    this.messageContainer = this.root.createEl('div', { cls: 'repeat-message' });
    // Hide until there's a message to manage spacing.
    this.messageContainer.style.display = 'none';
    this.buttonsContainer = this.root.createEl('div', { cls: 'repeat-buttons' });
    this.previewContainer = this.root.createEl('div', { cls: 'repeat-embedded_note' });
    this.currentDueFilePath = undefined;
  }

  setMessage(message: string) {
    this.messageContainer.style.display = 'block';
    this.messageContainer.setText(message);
  }

  async addRepeatButton(
    choice: RepeatChoice,
    file: TFile,
  ) {
    return this.buttonsContainer.createEl('button', {
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
  }
}

export default RepeatView;
