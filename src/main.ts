import {
  App,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
} from 'obsidian';
import { DateTime } from 'luxon';

import RepeatView, { REPEATING_NOTES_DUE_VIEW } from './repeat/obsidian/RepeatView';
import RepeatNoteSetupModal from './repeat/obsidian/RepeatNoteSetupModal';
import { RepeatPluginSettings, DEFAULT_SETTINGS } from './settings';
import { determineFrontmatterBounds, replaceOrInsertField } from './frontmatter';
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
    ribbonIconEl.addClass('repeat-plugin-ribbon-icon');

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
              let bounds = determineFrontmatterBounds(content);
              if (!bounds) {
                // Create new frontmatter, and update content and bounds.
                const newFrontmatter = '---\n---\n';
                editor.replaceRange(
                  newFrontmatter, { line: 0, ch: 0 }, { line: 0, ch: 0 });
                content = editor.getValue();
                bounds = determineFrontmatterBounds(content);
                if (!bounds) {
                  const filePath = markdownView.file.path;
                  throw Error(`Failed to create frontmatter in note ${filePath}.`);
                }
              }
              // Insert repetition properties with the desired frequency.
              const frontmatter = content.slice(...bounds);
              const repeatValue = unit === 'day' ? 'daily' : `${unit}ly`;
              let updatedFrontmatter = replaceOrInsertField(
                frontmatter, 'repeat', repeatValue);
              updatedFrontmatter = replaceOrInsertField(
                updatedFrontmatter,
                'repeat_due_at',
                // TODO: Use logic utils to update due date.
                DateTime.now().plus({ [unit]: 1 }).toISO());

              editor.setValue([
                content.slice(0, bounds[0]),
                updatedFrontmatter,
                content.slice(bounds[1]),
              ].join(''));
            }
            return true;
          }
          return false;
        }
      });
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
