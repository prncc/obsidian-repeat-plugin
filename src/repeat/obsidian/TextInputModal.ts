import { App, Modal, Setting } from 'obsidian';

class TextInputModal extends Modal {
  title: string;
  prompt: string;
  defaultValue: string;
  onSubmit: (result: string | null) => void;
  inputEl: HTMLInputElement | undefined;

  constructor(
    app: App,
    title: string,
    prompt: string,
    defaultValue: string,
    onSubmit: (result: string | null) => void
  ) {
    super(app);
    this.title = title;
    this.prompt = prompt;
    this.defaultValue = defaultValue;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.title });

    new Setting(contentEl)
      .setName(this.prompt)
      .addText((text) => {
        this.inputEl = text.inputEl;
        text.setValue(this.defaultValue);
        text.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            this.submit();
          }
        });
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Cancel')
          .onClick(() => {
            this.close();
            this.onSubmit(null);
          }))
      .addButton((btn) =>
        btn
          .setButtonText('Save')
          .setCta()
          .onClick(() => this.submit()));
  }

  submit() {
    const value = this.inputEl?.value.trim();
    this.close();
    this.onSubmit(value || null);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default TextInputModal;
