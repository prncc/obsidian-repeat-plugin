import {
  App,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
} from 'obsidian';

import RepeatView, { REPEATING_NOTES_DUE_VIEW } from './repeat/obsidian/RepeatView';
import RepeatNoteSetupModal from './repeat/obsidian/RepeatNoteSetupModal';
import { RepeatPluginSettings, DEFAULT_SETTINGS } from './settings';

export default class RepeatPlugin extends Plugin {
  settings: RepeatPluginSettings;

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
  }

  async onload() {
    await this.loadSettings();

    if (this.settings.showDueCountInStatusBar) {
      const statusBarItemEl = this.addStatusBarItem();
      statusBarItemEl.setText('Repeat notes due: X');
    }

    // TODO: Update note due count periodically.
    this.registerInterval(window.setInterval(
      () => {
        console.log('setInterval');
      },
      5 * 60 * 1000,
    ));
    this.registerView(
      REPEATING_NOTES_DUE_VIEW,
      (leaf) => new RepeatView(leaf),
    );

    const ribbonIconEl = this.addRibbonIcon(
      'clock', 'Review repeating notes that are due', (evt: MouseEvent) => {
        this.activateRepeatNotesDueView();
      });
    ribbonIconEl.addClass('repeat-pluggin-ribbon-icon');

    this.addSettingTab(new RepeatPluginSettingTab(this.app, this));

    // TODO: Implement commands and refactor into own method.
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
