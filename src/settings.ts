export interface RepeatPluginSettings {
  showDueCountInStatusBar: boolean;
  showRibbonIcon: boolean;
  ignoreFolderPath: string;
}

export const DEFAULT_SETTINGS: RepeatPluginSettings = {
  showDueCountInStatusBar: true,
  showRibbonIcon: true,
  ignoreFolderPath: "",
};
