import { DateTime } from 'luxon';
import { App, Modal, Setting } from 'obsidian';
import { incrementRepeatDueAt } from '../choices';
import { Repetition, Weekday } from '../repeatTypes';
import { summarizeDueAtWithPrefix } from '../utils';
import { RepeatPluginSettings } from '../../settings';

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
  weekdayContainerEl: HTMLElement | undefined;
  frequencyContainerEl: HTMLElement | undefined;
  weekdayToggles: Map<Weekday, any> = new Map();
  periodInputEl: any;
  periodUnitDropdownEl: any;
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
      ...settings.defaultRepeat,
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

    // Handle UI visibility based on strategy/unit changes
    if (key === 'repeatStrategy' || key === 'repeatPeriodUnit') {
      this.updateVisibility();
    }

    // Recalculate repeatDueAt and update picker's value.
    this.result.repeatDueAt = incrementRepeatDueAt({
      ...this.result,
      // Always recompute relative to now.
      repeatDueAt: undefined,
    }, this.settings);
    this.result.summary = summarizeDueAtWithPrefix(this.result.repeatDueAt);
    // Ensure UI consistency.
    if (this.datetimePickerEl) {
      this.datetimePickerEl.value = formatDateTimeForPicker(
        this.result.repeatDueAt);
    }
    this.dueAtSummaryEl?.setText(this.result.summary);
  }

  updateVisibility() {
    const isWeekdays = this.result.repeatPeriodUnit === 'WEEKDAYS';

    if (this.weekdayContainerEl) {
      this.weekdayContainerEl.style.display = isWeekdays ? 'block' : 'none';
    }
    if (this.frequencyContainerEl) {
      this.frequencyContainerEl.style.display = isWeekdays ? 'none' : 'block';
    }

    // Update weekday toggles to reflect current state
    if (isWeekdays && this.weekdayToggles.size > 0) {
      this.weekdayToggles.forEach((toggle, weekday) => {
        const shouldBeChecked = this.result.repeatWeekdays?.includes(weekday) || false;
        toggle.setValue(shouldBeChecked);
      });
    }

    // Update frequency input values when switching from weekdays
    if (!isWeekdays) {
      if (this.periodInputEl) {
        this.periodInputEl.setValue(`${this.result.repeatPeriod}`);
      }
      if (this.periodUnitDropdownEl) {
        this.periodUnitDropdownEl.setValue(this.result.repeatPeriodUnit);
      }
    }
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
        dropdown.addOption('WEEKDAYS', 'Weekdays');

        // Determine current strategy - if periodUnit is WEEKDAYS, show as WEEKDAYS strategy
        const currentStrategy = this.result.repeatPeriodUnit === 'WEEKDAYS' ? 'WEEKDAYS' : this.result.repeatStrategy;
        dropdown.setValue(currentStrategy);

        dropdown.onChange((value) =>	{
          if (value === 'WEEKDAYS') {
            this.result.repeatStrategy = 'PERIODIC'; // Weekdays are always periodic under the hood
            this.result.repeatPeriodUnit = 'WEEKDAYS';
            this.result.repeatPeriod = 1;
            if (!this.result.repeatWeekdays || this.result.repeatWeekdays.length === 0) {
              this.result.repeatWeekdays = ['monday'];
            }
          } else {
            this.result.repeatStrategy = value;
            this.result.repeatPeriodUnit = 'DAY'; // Reset to default
            this.result.repeatPeriod = 1;
            delete this.result.repeatWeekdays; // Remove weekdays when not using weekday strategy
          }
          this.updateResult('repeatStrategy', this.result.repeatStrategy);
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

        // Store reference for updates
        this.periodInputEl = text;
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

        // Store reference for updates
        this.periodUnitDropdownEl = dropdown;
      });

    this.frequencyContainerEl = frequencyEl.settingEl;

    // Add weekday selection UI container
    const weekdayContainerEl = contentEl.createEl('div');
    weekdayContainerEl.createEl('h4', { text: 'Select days' });
    weekdayContainerEl.createEl('p', {
      text: 'Choose on which days of the week to repeat',
      cls: 'setting-item-description'
    });

    // Create checkboxes for each day of the week
    const weekdays: { key: Weekday; label: string }[] = [
      { key: 'monday', label: 'Monday' },
      { key: 'tuesday', label: 'Tuesday' },
      { key: 'wednesday', label: 'Wednesday' },
      { key: 'thursday', label: 'Thursday' },
      { key: 'friday', label: 'Friday' },
      { key: 'saturday', label: 'Saturday' },
      { key: 'sunday', label: 'Sunday' }
    ];

    weekdays.forEach(({ key, label }) => {
      new Setting(weekdayContainerEl)
        .setName(label)
        .addToggle((toggle) => {
          const isSelected = this.result.repeatWeekdays?.includes(key) || false;
          toggle.setValue(isSelected);

          // Store toggle reference for later updates
          this.weekdayToggles.set(key, toggle);

          toggle.onChange((value) => {
            if (!this.result.repeatWeekdays) {
              this.result.repeatWeekdays = [];
            }

            if (value && !this.result.repeatWeekdays.includes(key)) {
              this.result.repeatWeekdays.push(key);
            } else if (!value) {
              this.result.repeatWeekdays = this.result.repeatWeekdays.filter(day => day !== key);
            }

            // Ensure at least one day is selected.
            if (this.result.repeatWeekdays.length === 0) {
              this.result.repeatWeekdays = ['monday'];
              // Update Monday toggle
              const mondayToggle = this.weekdayToggles.get('monday');
              if (mondayToggle) {
                mondayToggle.setValue(true);
              }
            }

            this.updateResult('repeatWeekdays', this.result.repeatWeekdays);
          });
        });
    });

    this.weekdayContainerEl = weekdayContainerEl;

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

    // Set initial visibility based on current settings
    this.updateVisibility();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default RepeatNoteSetupModal;
