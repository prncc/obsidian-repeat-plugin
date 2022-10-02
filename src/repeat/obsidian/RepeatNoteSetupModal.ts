import { DateTime } from 'luxon';
import { App, Modal, Setting } from 'obsidian';
import { AM_REVIEW_TIME, incrementRepeatDueAt, PM_REVIEW_TIME } from '../choices';
import { Repetition } from '../repeatTypes';
import { summarizeDueAt } from '../utils';

const formatDateTimeForPicker = (dt: DateTime) => (
  [
    dt.toFormat('yyyy-MM-dd'),
    'T',
    dt.toFormat('HH:mm')
  ].join('')
);

class RepeatNoteSetupModal extends Modal {
  result: any;
  datetimePickerEl: HTMLInputElement | undefined;
  onSubmit: (result: any) => void;

  constructor(
    app: App,
    onSubmit: (result: any) => void,
    initialValue?: Repetition,
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.updateResult = this.updateResult.bind(this)

    this.result = initialValue ?? {
      repeatStrategy: 'PERIODIC',
      repeatPeriod: 1,
      repeatPeriodUnit: 'DAY',
      repeatTimeOfDay: 'AM',
      repeatDueAt: undefined,
    };
    // TODO: Refactor method to avoid this hack.
    // Hack to populate initial repeatDueAt.
    this.updateResult('repeatPeriod', 1);
    this.datetimePickerEl;
  }

  updateResult(key: string, value: any) {
    this.result[key] = value;
    // Recalculate repeatDueAt and update picker's value.
    this.result.repeatDueAt = incrementRepeatDueAt(this.result);
    if (this.datetimePickerEl) {
      this.datetimePickerEl.value = formatDateTimeForPicker(
        this.result.repeatDueAt);
    }
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
        // Make text input fit better next to the dropdown.
        text.inputEl.type = 'number';
        text.inputEl.style.width = '150px';
        text.inputEl.style.marginRight = '5px';

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

    // Force text input's height to match adjacent dropdown's height.
    try {
      (frequencyEl.components[0] as any).inputEl.style.height =
        `${(frequencyEl.components[1] as any).selectEl.clientHeight}px`;
    } catch (e) {
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

    // Disable top border and padding of the setting container so that
    // time of day dropdown looks connected to the frequency inputs.
    try {
      timeOfDayEl.settingEl.style.borderTop = '0px';
      timeOfDayEl.settingEl.style.paddingTop = '0px';
    } catch (e) {
      console.error('Repeat Plugin: Could not set time of day HTML element styles:');
      console.error(e);
    }

    new Setting(contentEl)
      .setName('Next repeat')
      .setDesc(`in ${summarizeDueAt(this.result.repeatDueAt)}`)
      .addText((datetimePicker) => {
        // Hack to convert text input to datetime-local
        // (which degrades to text and should be similar enough).
        datetimePicker.inputEl.type = 'datetime-local';
        datetimePicker.inputEl.addClass('repeat-date_picker');
        const pickerValue = formatDateTimeForPicker(this.result.repeatDueAt);
        datetimePicker.inputEl.value = pickerValue;
        this.datetimePickerEl = datetimePicker.inputEl;
        datetimePicker.onChange((value) => {
          const parsedValue = DateTime.fromISO(value);
          // @ts-ignore: .invalid is added by luxon.
          if (parsedValue.invalid) {
            console.error('Repeat Plugin: Could not parse datetime from picker.');
            return;
          }
          this.result.repeatDueAt = parsedValue;
        });
      });

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
