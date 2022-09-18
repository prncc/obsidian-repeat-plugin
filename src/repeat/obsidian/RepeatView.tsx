import { DateTime } from 'luxon';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { getAPI, Literal } from 'obsidian-dataview';

export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

function isNoteDue(repeatDueAt: Literal | string | undefined): boolean {
  if (!repeatDueAt) {
    return false;
  }
  return repeatDueAt <= DateTime.now();
}

class RepeatView extends ItemView {
  root: Element;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.root = this.containerEl.children[1];
  }

  getViewType() {
    return REPEATING_NOTES_DUE_VIEW;
  }

  getDisplayText() {
    return 'Repeat';
  }

  async onOpen() {
    const dv = getAPI(this.app);
    if (!dv) {
      let container = this.root.createEl('div')
      container.setText(
        'Repeat Plugin requires DataView Plugin to work. ' +
        'Make sure it is installed and enabled.'
      )
      return;
    }
    let processed = false;
    const setPage = async () => {
      const pages = await dv?.pages()
          .where(({ repeat_due_at }) => isNoteDue(repeat_due_at))
          .sort(({ repeat_due_at }) => repeat_due_at, 'asc')
          .file.name;
        let container = this.root.createEl('div');
        container.setText(
          `file: ${pages ? pages[0] : ''}`);
        console.log(pages ? pages[0] : '');
        processed = true;
    }

    this.registerEvent(
      app?.metadataCache.on('dataview:index-ready', async () => {
        setPage();
      })
    );

    if (dv?.index.initialized && !processed) {
      setPage();
    }
  }
}

export default RepeatView;
