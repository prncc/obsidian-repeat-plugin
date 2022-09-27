import {
  App,
  MarkdownView,
  Plugin,
  PluginManifest,
  PluginSettingTab,
  Setting,
} from 'obsidian';

import RepeatView, { REPEATING_NOTES_DUE_VIEW } from './repeat/obsidian/RepeatView';
import RepeatNoteSetupModal from './repeat/obsidian/RepeatNoteSetupModal';
import { RepeatPluginSettings, DEFAULT_SETTINGS } from './settings';
import { replaceOrInsertFields } from './frontmatter';
import { getAPI } from 'obsidian-dataview';
import { getNotesDue } from './repeat/queries';
import { serializeRepetition } from './repeat/serializers';
import { incrementPeriodicToNextDueAt } from './repeat/choices';
import { PeriodUnit, Repetition, Strategy, TimeOfDay } from './repeat/repeatTypes';

export default class RepeatPlugin extends Plugin {
  settings: RepeatPluginSettings;
  statusBarItem: HTMLElement | undefined;
  ribbonIcon: HTMLElement | undefined;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.updateNotesDueCount = this.updateNotesDueCount.bind(this);
    this.manageStatusBarItem = this.manageStatusBarItem.bind(this);
    this.registerCommands = this.registerCommands.bind(this);
    this.manageRibbonIcon = this.manageRibbonIcon.bind(this);
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
    }
    if (this.settings.showDueCountInStatusBar) {
      this.statusBarItem = this.addStatusBarItem();
      this.updateNotesDueCount();
    }
  }

  updateNotesDueCount() {
    if (!this.statusBarItem) {
      this.statusBarItem = this.addStatusBarItem();
    }
    if (this.settings.showDueCountInStatusBar) {
      const dueNoteCount = getNotesDue(getAPI(this.app))?.length;
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
        this.updateNotesDueCount)
    );
    // Update due note count whenever metadata changes.
    this.registerEvent(
      this.app.metadataCache.on(
        // @ts-ignore: event is added by DataView.
        'dataview:metadata-change',
        this.updateNotesDueCount)
    );
    // Periodically update due note count as notes become due.
    const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
    this.registerInterval(
      window.setInterval(this.updateNotesDueCount, FIVE_MINUTES_IN_MS)
    )
  }

  manageRibbonIcon() {
    this.ribbonIcon = this.addRibbonIcon(
      'clock', 'Review notes due', () => {
        this.activateRepeatNotesDueView();
      });
  }

  registerCommands() {
    // TODO: Add command to view repeat page and setting to disable ribbon icon.
    // TODO: Implement setup-repeat-note command and refactor into own method.
    this.addCommand({
      id: 'setup-repeat-note',
      name: 'Repeat this note...',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        // TODO: Save repeat state on submit.
        const onSubmit = (result: string) => { console.log(result) };
        if (markdownView) {
          if (!checking) {
            new RepeatNoteSetupModal(this.app, onSubmit).open();
          }
          return true;
        }
        return false;
      }
    });

    ['day', 'week', 'month', 'year'].map((unit) => {
      this.addCommand({
        id: `repeat-every-${unit}`,
        name: `Repeat this note every ${unit}`,
        checkCallback: (checking: boolean) => {
          const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (markdownView) {
            if (!checking) {
              const { editor } = markdownView;
              let content = editor.getValue();
              const repeat = {
                repeatStrategy: 'PERIODIC' as Strategy,
                repeatPeriod: 1,
                repeatPeriodUnit: unit.toUpperCase() as PeriodUnit,
                repeatTimeOfDay: 'AM' as TimeOfDay,
              };
              const repeatDueAt = incrementPeriodicToNextDueAt({
                ...repeat,
                repeatDueAt: undefined,
              } as any);
              const newContent = replaceOrInsertFields(content, serializeRepetition({
                ...repeat,
                repeatDueAt,
              } as Repetition));
              editor.setValue(newContent);
            }
            return true;
          }
          return false;
        }
      });
    });
  }

  async onload() {
    await this.loadSettings();
    this.manageStatusBarItem();
    this.registerCommands();
    this.registerView(
      REPEATING_NOTES_DUE_VIEW,
      (leaf) => new RepeatView(leaf),
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
  }
}
