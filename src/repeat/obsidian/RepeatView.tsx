import {
  Component,
  debounce,
  ItemView,
  setIcon,
  WorkspaceLeaf,
  TFile,
} from 'obsidian';
import { getAPI, DataviewApi } from 'obsidian-dataview';

import { determineFrontmatterBounds, updateRepetitionMetadata } from '../../frontmatter';
import { getRepeatChoices } from '../choices';
import { RepeatChoice } from '../repeatTypes';
import { getNextDueNote, getNotesDue, getTagsFromDueNotes, TagStats } from '../queries';
import { serializeRepetition } from '../serializers';
import { renderMarkdown, renderTitleElement } from '../../markdown';
import { RepeatPluginSettings } from '../../settings';
import TextInputModal from './TextInputModal';

const MODIFY_DEBOUNCE_MS = 1 * 1000;
const QUERY_DEBOUNCE_MS = 500;
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
  settings: RepeatPluginSettings;

  // Filter UI elements
  filterContainer: HTMLElement;
  filterHeader: HTMLElement;
  filterContent: HTMLElement;
  filterToggleIcon: HTMLElement;
  queryInput: HTMLInputElement;
  tagShortcutsContainer: HTMLElement;
  savedFilterDropdown: HTMLSelectElement;
  filterCountEl: HTMLElement;
  filterErrorEl: HTMLElement;
  availableTags: TagStats[];
  displayedTagCount: number;
  saveSettings: () => Promise<void>;
  handleQueryChange: ReturnType<typeof debounce>;
  filterExpanded: boolean;

  constructor(leaf: WorkspaceLeaf, settings: RepeatPluginSettings, saveSettings: () => Promise<void>) {
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

    // Filter-related bindings
    this.createFilterUI = this.createFilterUI.bind(this);
    this.refreshFilterUI = this.refreshFilterUI.bind(this);
    this.doHandleQueryChange = this.doHandleQueryChange.bind(this);
    this.handleQueryChange = debounce(this.doHandleQueryChange, QUERY_DEBOUNCE_MS);
    this.handleTagClick = this.handleTagClick.bind(this);
    this.handleClearQuery = this.handleClearQuery.bind(this);
    this.handleSaveFilter = this.handleSaveFilter.bind(this);
    this.handleLoadSavedFilter = this.handleLoadSavedFilter.bind(this);
    this.handleDeleteSavedFilter = this.handleDeleteSavedFilter.bind(this);
    this.handleShowMoreTags = this.handleShowMoreTags.bind(this);
    this.toggleFilterDrawer = this.toggleFilterDrawer.bind(this);
    this.filterExpanded = false;

    this.component = new Component();

    this.dv = getAPI(this.app);
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.availableTags = [];
    this.displayedTagCount = 6;

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

    // Refresh the filter UI with current tags
    this.refreshFilterUI();

    const page = getNextDueNote(
      this.dv,
      this.settings.ignoreFolderPath,
      ignoreFilePath,
      this.settings.enqueueNonRepeatingNotes,
      this.settings.defaultRepeat,
      this.settings.filterQuery || undefined);
    if (!page) {
      // Check if there are notes due but filtered out
      const totalDue = getNotesDue(
        this.dv,
        this.settings.ignoreFolderPath,
        ignoreFilePath,
        this.settings.enqueueNonRepeatingNotes,
        this.settings.defaultRepeat
      )?.length || 0;

      if (totalDue > 0 && this.settings.filterQuery) {
        this.setMessage(`No notes matching filter. ${totalDue} other notes are due.`);
      } else {
        this.setMessage('All done for now!');
      }
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

    // .markdown-embed adds undesirable borders while loading,
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
      this.app,
      markdown.slice(
        delimitedFrontmatterBounds ? delimitedFrontmatterBounds[1] : 0),
      markdownContainer,
      file.path,
      this.component,
      this.app.vault);
  }

  resetView() {
    this.messageContainer && this.messageContainer.remove();
    this.filterContainer && this.filterContainer.remove();
    this.buttonsContainer && this.buttonsContainer.remove();
    this.previewContainer && this.previewContainer.remove();
    this.messageContainer = this.root.createEl('div', { cls: 'repeat-message' });
    // Hide until there's a message to manage spacing.
    this.messageContainer.style.display = 'none';
    this.createFilterUI();
    this.buttonsContainer = this.root.createEl('div', { cls: 'repeat-buttons' });
    this.previewContainer = this.root.createEl('div', { cls: 'repeat-embedded_note' });
    this.currentDueFilePath = undefined;
  }

  createFilterUI() {
    this.filterContainer = this.root.createEl('div', { cls: 'repeat-filter' });

    // Drawer header (always visible)
    this.filterHeader = this.filterContainer.createEl('div', { cls: 'repeat-filter-header' });
    this.filterHeader.addEventListener('click', this.toggleFilterDrawer);

    this.filterToggleIcon = this.filterHeader.createEl('span', {
      cls: 'repeat-filter-toggle-icon',
    });
    setIcon(this.filterToggleIcon, 'chevron-right');

    // Filter count display (in header, always visible)
    this.filterCountEl = this.filterHeader.createEl('span', {
      cls: 'repeat-filter-count'
    });

    // Collapsible content
    this.filterContent = this.filterContainer.createEl('div', {
      cls: 'repeat-filter-content'
    });
    this.filterContent.style.display = 'none';

    // Row 1: Query input + Clear button
    const queryRow = this.filterContent.createEl('div', { cls: 'repeat-filter-row' });

    this.queryInput = queryRow.createEl('input', {
      cls: 'repeat-filter-query-input',
      attr: {
        type: 'text',
        placeholder: 'Filter: #tag or Dataview expression...',
        value: this.settings.filterQuery || '',
      }
    });
    this.queryInput.value = this.settings.filterQuery || '';
    this.queryInput.addEventListener('input', () => this.handleQueryChange());
    this.queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleQueryChange();
        this.handleQueryChange.cancel?.();
      }
    });

    const clearBtn = queryRow.createEl('button', {
      cls: 'repeat-filter-btn',
      text: 'Clear',
    });
    clearBtn.addEventListener('click', this.handleClearQuery);

    // Row 2: Tag shortcuts
    this.tagShortcutsContainer = this.filterContent.createEl('div', {
      cls: 'repeat-filter-tags'
    });

    // Row 3: Saved filters dropdown + Save/Delete buttons
    const savedFilterRow = this.filterContent.createEl('div', { cls: 'repeat-filter-row' });

    this.savedFilterDropdown = savedFilterRow.createEl('select', {
      cls: 'repeat-filter-dropdown'
    });
    this.savedFilterDropdown.addEventListener('change', this.handleLoadSavedFilter);

    const saveBtn = savedFilterRow.createEl('button', {
      cls: 'repeat-filter-btn',
      text: 'Save',
    });
    saveBtn.addEventListener('click', this.handleSaveFilter);

    const deleteBtn = savedFilterRow.createEl('button', {
      cls: 'repeat-filter-btn repeat-filter-btn-danger',
      text: 'Delete',
    });
    deleteBtn.addEventListener('click', this.handleDeleteSavedFilter);

    // Error display (hidden by default)
    this.filterErrorEl = this.filterContent.createEl('div', {
      cls: 'repeat-filter-error'
    });
    this.filterErrorEl.style.display = 'none';
  }

  toggleFilterDrawer() {
    this.filterExpanded = !this.filterExpanded;
    this.filterContent.style.display = this.filterExpanded ? 'block' : 'none';
    setIcon(this.filterToggleIcon, this.filterExpanded ? 'chevron-down' : 'chevron-right');
    this.filterContainer.toggleClass('repeat-filter-expanded', this.filterExpanded);
  }

  renderTagShortcuts() {
    this.tagShortcutsContainer.empty();
    const tagsToShow = this.availableTags.slice(0, this.displayedTagCount);
    const hiddenCount = this.availableTags.length - this.displayedTagCount;

    tagsToShow.forEach(({ tag, count }) => {
      const tagBtn = this.tagShortcutsContainer.createEl('button', {
        cls: 'repeat-filter-tag',
        text: `${tag} (${count})`,
      });
      tagBtn.addEventListener('click', () => this.handleTagClick(tag));
    });

    if (hiddenCount > 0) {
      const moreLink = this.tagShortcutsContainer.createEl('button', {
        cls: 'repeat-filter-tag-more',
        text: `+${hiddenCount} more`,
      });
      moreLink.addEventListener('click', this.handleShowMoreTags);
    }
  }

  handleShowMoreTags() {
    this.displayedTagCount += 6;
    this.renderTagShortcuts();
  }

  refreshFilterUI() {
    // Get all tags from due notes (without filtering)
    this.availableTags = getTagsFromDueNotes(
      this.dv,
      this.settings.ignoreFolderPath,
      undefined,
      this.settings.enqueueNonRepeatingNotes,
      this.settings.defaultRepeat
    ) || [];

    // Reset displayed count when refreshing (e.g., after reviewing a note)
    this.displayedTagCount = 6;

    this.renderTagShortcuts();

    // Update saved filters dropdown
    this.savedFilterDropdown.empty();
    const defaultOption = this.savedFilterDropdown.createEl('option', {
      text: 'Load saved filter...',
      attr: { value: '' }
    });
    defaultOption.disabled = true;

    // Find if current query matches a saved filter
    const matchingFilterIndex = this.settings.savedFilters.findIndex(
      f => f.query === this.settings.filterQuery
    );

    // Select the placeholder only if no filter matches
    if (matchingFilterIndex === -1) {
      defaultOption.selected = true;
    }

    this.settings.savedFilters.forEach((filter, index) => {
      const option = this.savedFilterDropdown.createEl('option', {
        text: filter.name,
        attr: { value: index.toString() }
      });
      if (index === matchingFilterIndex) {
        option.selected = true;
      }
    });

    // Update filter count
    this.updateFilterCount();
  }

  updateFilterCount() {
    const filterQuery = this.settings.filterQuery;

    // Get total due notes (unfiltered)
    const totalCount = getNotesDue(
      this.dv,
      this.settings.ignoreFolderPath,
      undefined,
      this.settings.enqueueNonRepeatingNotes,
      this.settings.defaultRepeat
    )?.length || 0;

    if (filterQuery) {
      // Get filtered count
      try {
        const filteredCount = getNotesDue(
          this.dv,
          this.settings.ignoreFolderPath,
          undefined,
          this.settings.enqueueNonRepeatingNotes,
          this.settings.defaultRepeat,
          filterQuery
        )?.length || 0;

        // Check if this matches a named filter
        const matchingFilter = this.settings.savedFilters.find(
          f => f.query === filterQuery
        );

        if (matchingFilter) {
          this.filterCountEl.textContent = `${matchingFilter.name}: ${filteredCount} matching, ${totalCount} total`;
        } else {
          this.filterCountEl.textContent = `${filteredCount} matching, ${totalCount} total`;
        }
        this.filterErrorEl.style.display = 'none';
      } catch (e) {
        this.filterCountEl.textContent = `${totalCount} notes due`;
        this.filterErrorEl.textContent = `Invalid filter: ${e.message || 'Check your query syntax'}`;
        this.filterErrorEl.style.display = 'block';
      }
    } else {
      this.filterCountEl.textContent = `${totalCount} notes due`;
      this.filterErrorEl.style.display = 'none';
    }
  }

  doHandleQueryChange() {
    const newQuery = this.queryInput.value.trim();
    if (newQuery !== this.settings.filterQuery) {
      this.settings.filterQuery = newQuery;
      this.saveSettings();
      this.updateFilterCount();
      // Re-render the current page with new filter
      this.buttonsContainer.empty();
      this.previewContainer.empty();
      this.previewContainer.removeClass('markdown-embed');
      this.setPage();
    }
  }

  handleTagClick(tag: string) {
    const currentQuery = this.queryInput.value.trim();
    if (currentQuery) {
      // Append with OR
      this.queryInput.value = `${currentQuery} OR ${tag}`;
    } else {
      this.queryInput.value = tag;
    }
    this.handleQueryChange();
  }

  async handleClearQuery() {
    this.queryInput.value = '';
    this.settings.filterQuery = '';
    await this.saveSettings();
    this.updateFilterCount();
    // Re-render
    this.buttonsContainer.empty();
    this.previewContainer.empty();
    this.previewContainer.removeClass('markdown-embed');
    this.setPage();
  }

  async handleSaveFilter() {
    const currentQuery = this.settings.filterQuery;
    if (!currentQuery) {
      return; // Nothing to save
    }

    const modal = new TextInputModal(
      this.app,
      'Save Filter',
      'Filter name',
      '',
      async (name) => {
        if (!name) return;

        // Check for duplicate names and update or add
        const existingIndex = this.settings.savedFilters.findIndex(f => f.name === name);
        if (existingIndex >= 0) {
          this.settings.savedFilters[existingIndex].query = currentQuery;
        } else {
          this.settings.savedFilters.push({ name, query: currentQuery });
        }

        await this.saveSettings();
        this.refreshFilterUI();
      }
    );
    modal.open();
  }

  async handleLoadSavedFilter(event: Event) {
    const select = event.target as HTMLSelectElement;
    const filterIndex = parseInt(select.value);

    if (isNaN(filterIndex)) return;

    const filter = this.settings.savedFilters[filterIndex];
    if (filter) {
      this.queryInput.value = filter.query;
      this.settings.filterQuery = filter.query;
      await this.saveSettings();
      this.updateFilterCount();
      // Re-render
      this.buttonsContainer.empty();
      this.previewContainer.empty();
      this.previewContainer.removeClass('markdown-embed');
      this.setPage();
    }
  }

  async handleDeleteSavedFilter() {
    const select = this.savedFilterDropdown;
    const filterIndex = parseInt(select.value);

    if (isNaN(filterIndex)) return;

    const filter = this.settings.savedFilters[filterIndex];
    if (filter) {
      // Clear query if it matches the deleted filter
      const shouldClearQuery = this.settings.filterQuery === filter.query;

      this.settings.savedFilters.splice(filterIndex, 1);

      if (shouldClearQuery) {
        this.settings.filterQuery = '';
        this.queryInput.value = '';
      }

      await this.saveSettings();

      if (shouldClearQuery) {
        // Re-render with cleared filter
        this.buttonsContainer.empty();
        this.previewContainer.empty();
        this.previewContainer.removeClass('markdown-embed');
        this.setPage();
      } else {
        this.refreshFilterUI();
      }
    }
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
