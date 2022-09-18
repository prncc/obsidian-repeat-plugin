import { App, Modal, Setting } from 'obsidian';

class RepeatNoteSetupModal extends Modal {
  result: string;
  onSubmit: (result: string) => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;

    // TODO: Implement repeat choice menu.
    new Setting(contentEl)
      .setName('Repeat frequency')
      .addText((text) =>
        text.onChange((value) => {
          this.result = value
        }));

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Set Up Repetition')
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit(this.result);
          }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default RepeatNoteSetupModal;
