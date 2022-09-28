import { App, Modal, Setting } from 'obsidian';
import { AM_REVIEW_TIME, incrementPeriodicToNextDueAt, PM_REVIEW_TIME } from '../choices';
import { fullySummarizeDueAt } from '../utils';

class RepeatNoteSetupModal extends Modal {
  result: any;
  onSubmit: (result: any) => void;

  constructor(app: App, onSubmit: (result: any) => void) {
    super(app);
    // TODO: read initial values in from note.
    this.result = {
      repeatStrategy: 'PERIODIC',
      repeatPeriod: 1,
      repeatPeriodUnit: 'DAY',
      repeatTimeOfDay: 'AM',
    };
    this.onSubmit = onSubmit;
    this.updateResult = this.updateResult.bind(this)
  }

  updateResult(key: string, value: any) {
    this.result[key] = value;
    this.result.repeatDueAt = incrementPeriodicToNextDueAt({
      ...this.result,
      repeatDueAt: undefined,
    });
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.empty();

    new Setting(contentEl)
      .setName('Repeat type')
      .addDropdown((dropdown) => {
        dropdown.setValue(this.result.repeatStrategy);
        dropdown.addOption('PERIODIC', 'Periodic');
        dropdown.addOption('SPACED', 'Spaced');
        dropdown.onChange((value) =>	{
          this.updateResult('repeatStrategy', value);
        });
      });

    const frequencyEl = new Setting(contentEl)
      .setName('Repeat in')
      .addText((text) => {
        text.setValue(`${this.result.repeatPeriod}`);
        text.onChange((value) => {
          // TODO: invalidate negative periods
          const repeatPeriod = parseInt(value) || 1;
          this.updateResult('repeatPeriod', repeatPeriod);
        });
      })
      .addDropdown((dropdown) => {
        dropdown.setValue(this.result.repeatPeriodUnit);
        dropdown.addOption('DAY', 'day(s)');
        dropdown.addOption('WEEK', 'week(s)');
        dropdown.addOption('MONTH', 'month(s)');
        dropdown.addOption('YEAR', 'year(s)');
        dropdown.onChange((value) =>	{
          this.updateResult('repeatPeriodUnit', value);
        });
      });

    // TODO: Set when adding element.
    try {
      frequencyEl.components[0].inputEl.type = 'number';
      frequencyEl.components[0].inputEl.style.height = `${frequencyEl.components[1].selectEl.clientHeight}px`;
      frequencyEl.components[0].inputEl.style.width = '150px';
      frequencyEl.components[0].inputEl.style.marginRight = '5px';
    } catch (e) {
      console.error('Could not set repeat period HTML element styles.');
      console.error(e);
    }

    const timeOfDayEl = new Setting(contentEl)
      .addDropdown((dropdown) => {
        dropdown.setValue(this.result.repeatTimeOfDay);
        dropdown.addOption('AM', `at ${AM_REVIEW_TIME} AM in the morning`);
        dropdown.addOption('PM', `at ${PM_REVIEW_TIME % 12} PM in the evening`);
        dropdown.onChange((value) =>	{
          this.updateResult('repeatTimeOfDay', value);
        });
      });

    // TODO: Set when adding element.
    try {
      timeOfDayEl.settingEl.style.borderTop = '0px';
      timeOfDayEl.settingEl.style.paddingTop = '0px';
    } catch (e) {
      console.error('Could not set time of day HTML element styles.');
      console.error(e);
    }

    // TODO: Add date picker and summary to select the first repeat.

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
