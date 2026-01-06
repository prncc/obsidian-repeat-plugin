import { Repeat } from "./repeat/repeatTypes";

export interface SavedFilter {
  name: string;
  query: string;  // Dataview FROM expression, e.g. "#math" or "#math AND \"Courses\""
}

export interface RepeatPluginSettings {
  showDueCountInStatusBar: boolean;
  showRibbonIcon: boolean;
  ignoreFolderPath: string;
  morningReviewTime: string;
  eveningReviewTime: string;
  defaultRepeat: Repeat;
  enqueueNonRepeatingNotes: boolean;
  filterQuery: string;              // Current Dataview FROM expression
  savedFilters: SavedFilter[];      // Named filter presets
}

export const DEFAULT_SETTINGS: RepeatPluginSettings = {
  showDueCountInStatusBar: true,
  showRibbonIcon: true,
  ignoreFolderPath: '',
  morningReviewTime: '06:00',
  eveningReviewTime: '18:00',
  defaultRepeat: {
    repeatStrategy: 'SPACED',
    repeatPeriod: 1,
    repeatPeriodUnit: 'DAY',
    repeatTimeOfDay: 'AM',
  },
  enqueueNonRepeatingNotes: false,
  filterQuery: '',
  savedFilters: [],
};
