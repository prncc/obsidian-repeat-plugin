import {
  Component,
  debounce,
  ItemView,
  WorkspaceLeaf,
  TFile,
} from 'obsidian';
import { getAPI, DataviewApi } from 'obsidian-dataview';

import { determineFrontmatterBounds, updateRepetitionMetadata } from '../../frontmatter';
import { getRepeatChoices } from '../choices';
import { RepeatChoice } from '../repeatTypes';
import { getNextDueNote } from '../queries';
import { serializeRepetition } from '../serializers';
import { renderMarkdown, renderTitleElement } from '../../markdown';
import { RepeatPluginSettings } from '../../settings';

const MODIFY_DEBOUNCE_MS = 1 * 1000;
export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

class RepeatView extends ItemView {
  buttonsContainer: HTMLElement;
  component: Component;
  currentDueFilePath: string | undefined;
  dv: DataviewApi | undefined;
  icon = 'clock';
  ignoreFolderPath: string;
  indexPromise: Promise<null> | undefined;
  messageContainer: HTMLElement;
  previewContainer: HTMLElement;
  root: Element;
  settings: RepeatPluginSettings;

  constructor(leaf: WorkspaceLeaf, ignoreFolderPath: string, settings: RepeatPluginSettings) {
    super(leaf);
    this.addRepeatButton = this.addRepeatButton.bind(this);
    this.disableExternalHandlers = this.disableExternalHandlers.bind(this);
    this.enableExternalHandlers = this.enableExternalHandlers.bind(this);
    this.handleExternalModifyOrDelete = debounce(
      this.handleExternalModifyOrDelete,
      MODIFY_DEBOUNCE_MS).bind(this);
    this.handleExternalRename = debounce(
      this.handleExternalRename,
      MODIFY_DEBOUNCE_MS).bind(this);
    this.promiseMetadataChangeOrTimeOut = (
      this.promiseMetadataChangeOrTimeOut.bind(this));
    this.setMessage = this.setMessage.bind(this);
    this.setPage = this.setPage.bind(this);
    this.resetView = this.resetView.bind(this);

    this.component = new Component();

    this.dv = getAPI(this.app);
    this.settings = settings;
    this.ignoreFolderPath = ignoreFolderPath;

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

    this.resetView();
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
    let resolver: (...data: any) => any;
    return new Promise((resolve) => {
      resolver = (_, eventFile, previousPath) => {
        if (eventFile?.path === this.currentDueFilePath
            || previousPath === this.currentDueFilePath) {
          resolve(null);
        }
      };
      this.registerEvent(
        // @ts-ignore: event is added by DataView.
        this.app.metadataCache.on('dataview:metadata-change', resolver));
      setTimeout(resolve, 100);
    }).then(() => {
      this.app.metadataCache.off('dataview:metadata-change', resolver);
    });
  }

  async handleExternalModifyOrDelete(file: TFile) {
    // Current note might be swapped if user edits it to be due later.
    // However, this shouldn't happen when *other* notes are edited.
    if (file.path === this.currentDueFilePath) {
      await this.promiseMetadataChangeOrTimeOut();
      this.resetView();
      this.setPage();
    }
  }

  async handleExternalRename(file: TFile, oldFilePath: string) {
    // This only has to handle renames of this file because automatically
    // updated embedded links emit their own modify event.
    if (oldFilePath === this.currentDueFilePath) {
      await this.promiseMetadataChangeOrTimeOut();
      this.resetView();
      this.setPage();
    }
  }

  async setPage(ignoreFilePath?: string | undefined) {
    await this.indexPromise;
    // Reset the message container so that loading message is hidden.
    this.setMessage('');
    this.messageContainer.style.display = 'none';
    const page = getNextDueNote(this.dv, this.ignoreFolderPath, ignoreFilePath);
    if (!page) {
      this.setMessage('All done for now!');
      this.buttonsContainer.createEl('button', {
        text: 'Refresh',
      },
      (buttonElement) => {
        buttonElement.onclick = () => {
          this.resetView();
          this.setPage();
        }
      });
      return;
    }
    const dueFilePath = (page?.file as any).path;
    this.currentDueFilePath = dueFilePath;
    const choices = getRepeatChoices(page.repetition as any, this.settings);
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

    // Add container for markdown content.
    const markdownContainer = createEl('div', {
      cls: 'markdown-embed-content',
    });
    if ((page?.repetition as any)?.hidden) {
      markdownContainer.addClass('repeat-markdown_blurred');
      const onBlurredClick = (event) => {
        event.preventDefault();
        markdownContainer.removeClass('repeat-markdown_blurred');
      }
      markdownContainer.addEventListener(
        'click', onBlurredClick, { once: true });
    }

    this.previewContainer.appendChild(markdownContainer);

    // Render the note contents.
    const markdown = await this.app.vault.cachedRead(file);
    const delimitedFrontmatterBounds = determineFrontmatterBounds(markdown, true);
    await renderMarkdown(
      markdown.slice(
        delimitedFrontmatterBounds ? delimitedFrontmatterBounds[1] : 0),
      markdownContainer,
      file.path,
      this.component,
      this.app.vault);
  }

  resetView() {
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
          this.resetView();
          if (!choice.nextRepetition) {
            // TODO: Handle case of null nextRepetition properly.
            this.setPage();
            return;
          }
          const markdown = await this.app.vault.read(file);
          const newMarkdown = updateRepetitionMetadata(
            markdown, serializeRepetition(choice.nextRepetition));
          this.app.vault.modify(file, newMarkdown);
          this.setPage(file.path);
        }
      });
  }
}

export default RepeatView;
