import { Repeat } from "./repeat/repeatTypes";

export interface RepeatPluginSettings {
  showDueCountInStatusBar: boolean;
  showRibbonIcon: boolean;
  ignoreFolderPath: string;
  morningReviewTime: string;
  eveningReviewTime: string;
  defaultRepeat: Repeat;
}

export const DEFAULT_SETTINGS: RepeatPluginSettings = {
  showDueCountInStatusBar: true,
  showRibbonIcon: true,
  ignoreFolderPath: '',
  morningReviewTime: '06:00',
  eveningReviewTime: '18:00',
  defaultRepeat: {
    repeatStrategy: 'SPACED',
    repeatPeriod: 2,
    repeatPeriodUnit: 'DAY',
    repeatTimeOfDay: 'AM',
  },
};
