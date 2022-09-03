import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';

import RepeatingNotesDueRoot from './RepeatingNotesDueRoot';

export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

class ExampleView extends ItemView {
  root: Root;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.root = createRoot(this.containerEl.children[1]);
  }

  getViewType() {
    return REPEATING_NOTES_DUE_VIEW;
  }

  getDisplayText() {
    return 'Repeating Notes Due';
  }

  async onOpen() {
    this.root.render(
      <React.StrictMode>
        <RepeatingNotesDueRoot />
      </React.StrictMode>
    );
  }

  async onClose() {
    this.root.unmount();
  }
}

export default ExampleView;
