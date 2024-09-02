import {
  App,
  debounce,
  MarkdownView,
  Plugin,
  PluginManifest,
  PluginSettingTab,
  Setting,
} from 'obsidian';

import RepeatView, { REPEATING_NOTES_DUE_VIEW } from './repeat/obsidian/RepeatView';
import RepeatNoteSetupModal from './repeat/obsidian/RepeatNoteSetupModal';
import { RepeatPluginSettings, DEFAULT_SETTINGS } from './settings';
import { updateRepetitionMetadata } from './frontmatter';
import { getAPI } from 'obsidian-dataview';
import { getNotesDue } from './repeat/queries';
import { parseHiddenFieldFromMarkdown, parseRepeat, parseRepetitionFromMarkdown } from './repeat/parsers';
import { serializeRepeat, serializeRepetition } from './repeat/serializers';
import { incrementRepeatDueAt } from './repeat/choices';
import { PeriodUnit, Repetition, Strategy, TimeOfDay } from './repeat/repeatTypes';

const COUNT_DEBOUNCE_MS = 5 * 1000;

export default class RepeatPlugin extends Plugin {
  settings: RepeatPluginSettings;
  statusBarItem: HTMLElement | undefined;
  ribbonIcon: HTMLElement | undefined;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.updateNotesDueCount = debounce(
      this.updateNotesDueCount, COUNT_DEBOUNCE_MS).bind(this);
    this.manageStatusBarItem = this.manageStatusBarItem.bind(this);
    this.registerCommands = this.registerCommands.bind(this);
    this.makeRepeatRibbonIcon = this.makeRepeatRibbonIcon.bind(this);
  }

  async activateRepeatNotesDueView() {
    // Allow only one repeat view.
    this.app.workspace.detachLeavesOfType(REPEATING_NOTES_DUE_VIEW);

    // Create a new leaf for the view.
    await this.app.workspace.getLeaf(true).setViewState({
      type: REPEATING_NOTES_DUE_VIEW,
      active: true,
    });
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(REPEATING_NOTES_DUE_VIEW)[0]
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (!this.settings.showDueCountInStatusBar && this.statusBarItem) {
      this.statusBarItem.remove();
      this.statusBarItem = undefined;
    }
    if (this.settings.showDueCountInStatusBar) {
      this.updateNotesDueCount();
    }
    if (!this.settings.showRibbonIcon && this.ribbonIcon) {
      this.ribbonIcon.remove();
      this.ribbonIcon = undefined;
    }
    if (this.settings.showRibbonIcon && !this.ribbonIcon) {
      this.makeRepeatRibbonIcon();
    }
  }

  updateNotesDueCount() {
    if (this.settings.showDueCountInStatusBar) {
      if (!this.statusBarItem) {
        this.statusBarItem = this.addStatusBarItem();
      }
      const dueNoteCount = getNotesDue(
        getAPI(this.app), this.settings.ignoreFolderPath)?.length;
      if (dueNoteCount != undefined && this.statusBarItem) {
        this.statusBarItem.setText(
          `${dueNoteCount} repeat notes due`);
      }
    }
  }

  manageStatusBarItem() {
    // Update due note count when the DataView index populates.
    this.registerEvent(
      this.app.metadataCache.on(
        // @ts-ignore: event is added by DataView.
        'dataview:index-ready',
        () => {
          this.updateNotesDueCount();
          // Update due note count whenever metadata changes.
          setTimeout(() => {
            this.registerEvent(
              this.app.metadataCache.on(
                // @ts-ignore: event is added by DataView.
                'dataview:metadata-change',
                this.updateNotesDueCount
              )
            );
          }, COUNT_DEBOUNCE_MS);
        })
    );
    // Periodically update due note count as notes become due.
    const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
    this.registerInterval(
      window.setInterval(this.updateNotesDueCount, FIVE_MINUTES_IN_MS)
    )
  }

  makeRepeatRibbonIcon() {
    if (this.settings.showRibbonIcon) {
      this.ribbonIcon = this.addRibbonIcon(
        'clock', 'Repeat due notes', () => {
          this.activateRepeatNotesDueView();
        }
      );
    }
  }

  registerCommands() {
    this.addCommand({
      id: 'setup-repeat-note',
      name: 'Repeat this note...',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const onSubmit = (result: Repetition) => {
          if (!markdownView || !markdownView.file) {
            return;
          }
          const { editor, file } = markdownView;
          const content = editor.getValue();
          const newContent = updateRepetitionMetadata(
            content, serializeRepetition(result));
          this.app.vault.modify(file, newContent);
        };
        if (markdownView) {
          if (!checking) {
            let repetition;
            if (markdownView) {
              const { editor } = markdownView;
              const content = editor.getValue();
              repetition = parseRepetitionFromMarkdown(content);
            }
            new RepeatNoteSetupModal(
              this.app,
              onSubmit,
              this.settings,
              repetition,
            ).open();
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'open-repeat-view',
      name: 'Review due notes',
      callback: () => {
        this.activateRepeatNotesDueView();
      },
    });

    ['day', 'week', 'month', 'year'].map((unit) => {
      this.addCommand({
        id: `repeat-every-${unit}`,
        name: `Repeat this note every ${unit}`,
        checkCallback: (checking: boolean) => {
          const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (markdownView && !!markdownView.file) {
            if (!checking) {
              const { editor, file } = markdownView;
              const content = editor.getValue();
              const repeat = {
                repeatStrategy: 'PERIODIC' as Strategy,
                repeatPeriod: 1,
                repeatPeriodUnit: unit.toUpperCase() as PeriodUnit,
                repeatTimeOfDay: 'AM' as TimeOfDay,
              };
              const repeatDueAt = incrementRepeatDueAt({
                ...repeat,
                repeatDueAt: undefined,
              } as any, this.settings);
              const newContent = updateRepetitionMetadata(content, serializeRepetition({
                ...repeat,
                hidden: parseHiddenFieldFromMarkdown(content),
                repeatDueAt,
              }));
              this.app.vault.modify(file, newContent);
            }
            return true;
          }
          return false;
        }
      });
    });

    this.addCommand({
      id: 'repeat-never',
      name: 'Never repeat this note',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView && !!markdownView.file) {
          if (!checking) {
            const { editor, file } = markdownView;
            const content = editor.getValue();
            const newContent = updateRepetitionMetadata(content, {
              repeat: 'never',
              due_at: undefined,
              hidden: undefined,
            });
            this.app.vault.modify(file, newContent);
          }
          return true;
        }
        return false;
      }
    });
  }

  async onload() {
    await this.loadSettings();
    this.makeRepeatRibbonIcon();
    this.manageStatusBarItem();
    this.registerCommands();
    this.registerView(
      REPEATING_NOTES_DUE_VIEW,
      (leaf) => new RepeatView(leaf, this.settings),
      );
    this.addSettingTab(new RepeatPluginSettingTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(REPEATING_NOTES_DUE_VIEW);
  }
}

class RepeatPluginSettingTab extends PluginSettingTab {
  plugin: RepeatPlugin;

  constructor(app: App, plugin: RepeatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Repeat Plugin Settings' });

    new Setting(containerEl)
      .setName('Show due count in status bar')
      .setDesc('Whether to display how many notes are due in Obsidian\'s status bar.')
      .addToggle(component => component
        .setValue(this.plugin.settings.showDueCountInStatusBar)
        .onChange(async (value) => {
          this.plugin.settings.showDueCountInStatusBar = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
        .setName('Show ribbon icon')
        .setDesc('Whether to display the ribbon icon that opens the Repeat pane.')
        .addToggle(component => component
          .setValue(this.plugin.settings.showRibbonIcon)
          .onChange(async (value) => {
            this.plugin.settings.showRibbonIcon = value;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
        .setName('Ignore folder path')
        .setDesc('Notes in this folder and its subfolders will not become due. Useful to avoid reviewing templates.')
        .addText((component) => component
          .setValue(this.plugin.settings.ignoreFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.ignoreFolderPath = value;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
        .setName('Morning review time')
        .setDesc('When morning and long-term notes become due in the morning.')
        .addText((component) => {
          component.inputEl.type = 'time';
          component.inputEl.addClass('repeat-date_picker');
          component.setValue(this.plugin.settings.morningReviewTime);
          component.onChange(async (value) => {
            const usedValue = value >= '12:00' ? '11:59' : value;
            this.plugin.settings.morningReviewTime = usedValue;
            component.setValue(usedValue);
            await this.plugin.saveSettings();
          });
        });

      new Setting(containerEl)
        .setName('Evening review time')
        .setDesc('When evening notes become due in the afternoon.')
        .addText((component) => {
          component.inputEl.type = 'time';
          component.inputEl.addClass('repeat-date_picker');
          component.setValue(this.plugin.settings.eveningReviewTime);
          component.onChange(async (value) => {
            const usedValue = value < '12:00' ? '12:00' : value;
            this.plugin.settings.eveningReviewTime = usedValue;
            component.setValue(usedValue);
            await this.plugin.saveSettings();
          });
        });

      new Setting(containerEl)
        .setName('Default `repeat` property')
        .setDesc('Used to populate "Repeat this note..." command\'s modal. Ignored if the supplied value is not parsable.')
        .addText((component) => {
          console.log(this.plugin.settings.defaultRepeat);
          return component
            .setValue(serializeRepeat(this.plugin.settings.defaultRepeat))
            .onChange(async (value) => {
              const newRepeat = parseRepeat(value);
              this.plugin.settings.defaultRepeat = newRepeat;
              await this.plugin.saveSettings();
            });
        });

  }
}
