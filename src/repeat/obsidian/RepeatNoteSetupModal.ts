import { DateTime } from 'luxon';
import { App, Modal, Setting } from 'obsidian';
import { incrementRepeatDueAt } from '../choices';
import { Repetition } from '../repeatTypes';
import { summarizeDueAtWithPrefix } from '../utils';
import { RepeatPluginSettings } from 'src/settings';

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
  dueAtSummaryEl: HTMLElement | undefined;
  onSubmit: (result: any) => void;
  settings: RepeatPluginSettings;

  constructor(
    app: App,
    onSubmit: (result: any) => void,
    settings: RepeatPluginSettings,
    initialValue?: Repetition,
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.updateResult = this.updateResult.bind(this);
    this.settings = settings;

    this.result = initialValue ? { ...initialValue } : {
      repeatStrategy: 'SPACED',
      repeatPeriod: 1,
      repeatPeriodUnit: 'DAY',
      repeatTimeOfDay: 'AM',
      repeatDueAt: undefined,
      hidden: false,
    };
    // Populate initial repeatDueAt.
    if (!this.result.repeatDueAt) {
      this.updateResult('repeatPeriod', this.result.repeatPeriod);
    }
    // Populate initial summary.
    this.result.summary = summarizeDueAtWithPrefix(this.result.repeatDueAt);
    this.datetimePickerEl;
  }

  updateResult(key: string, value: any) {
    this.result[key] = value;
    // Recalculate repeatDueAt and update picker's value.
    this.result.repeatDueAt = incrementRepeatDueAt({
      ...this.result,
      // Always recompute relative to now.
      repeatDueAt: undefined,
    });
    this.result.summary = summarizeDueAtWithPrefix(this.result.repeatDueAt);
    // Ensure UI consistency.
    if (this.datetimePickerEl) {
      this.datetimePickerEl.value = formatDateTimeForPicker(
        this.result.repeatDueAt);
    }
    this.dueAtSummaryEl?.setText(this.result.summary);
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.empty();
    contentEl.addClass('repeat-setup_modal');

    new Setting(contentEl)
      .setName('Repeat type')
      .addDropdown((dropdown) => {
        dropdown.addOption('PERIODIC', 'Periodic');
        dropdown.addOption('SPACED', 'Spaced');
        dropdown.setValue(this.result.repeatStrategy);
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
        dropdown.addOption('HOUR', 'hour(s)');
        dropdown.addOption('DAY', 'day(s)');
        dropdown.addOption('WEEK', 'week(s)');
        dropdown.addOption('MONTH', 'month(s)');
        dropdown.addOption('YEAR', 'year(s)');
        dropdown.setValue(this.result.repeatPeriodUnit);
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
        // TODO: Parse review times and use AM/PM.
        // TODO: Only show this if the repetition period is long enough.
        dropdown.addOption('AM', `in the morning at ${this.settings.morningReviewTime}`);
        dropdown.addOption('PM', `in the evening at ${this.settings.eveningReviewTime}`);
        dropdown.setValue(this.result.repeatTimeOfDay);
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

    const nextRepeatEl = new Setting(contentEl)
      .setName('Next repeat')
      .setDesc(this.result.summary)
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
          this.result.summary = summarizeDueAtWithPrefix(this.result.repeatDueAt);
          this.dueAtSummaryEl?.setText(this.result.summary);
        });
      });
    this.dueAtSummaryEl = nextRepeatEl?.descEl;

    new Setting(contentEl)
      .setName('Hidden')
      .setDesc('Blur contents until clicked')
      .addToggle(toggle => toggle.setValue(this.result.hidden)
        .onChange((value) => {
          this.result.hidden = value;
        }));

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Set Up Repetition')
          .setCta()
          .onClick(() => {
            // Remove local summary field that's not needed outside the component.
            const final = { ...this.result };
            delete final.summary;
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
