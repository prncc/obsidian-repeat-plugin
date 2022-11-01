import { Component, MarkdownPreviewView, Vault, setIcon, TFile } from 'obsidian';

enum EmbedType {
  Image = 'Image',
  Audio = 'Audio',
  Video = 'Video',
  PDF = 'PDF',
  Note = 'Note',
  Unknown = 'Unknown',
}

// https://help.obsidian.md/Advanced+topics/Accepted+file+formats
const embedTypeToAcceptedExtensions = {
  [EmbedType.Image]: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'],
  [EmbedType.Audio]: ['mp3', 'webm', 'wav', 'm4a', 'ogg', '3gp', 'flac'],
  [EmbedType.Video]: ['mp4', 'webm', 'ogv', 'mov', 'mkv'],
  [EmbedType.PDF]: ['pdf'],
}

// Form src regexes that detect the type of embed.
const embedTypeToSrcRegex = {};
Object.keys(embedTypeToAcceptedExtensions).forEach((key) => {
  embedTypeToSrcRegex[key] = new RegExp([
    '.+\\.(',
    embedTypeToAcceptedExtensions[key].join('|'),
    ').*',
  ].join(''), 'i');
});

/**
 * Resolved path suitable for constructing a canonical file URI.
 *
 * Obsidian does some path inference in case links don't specify a full path.
 * @param vault Vault which contains the file.
 * @param pathSuffix Path suffix of file, something like its name or all or part
 *   of the containing subdir + its name.
 * @returns Full path of file, or just pathSuffix if no file matched.
 */
function getFirstMatchingFilePath(vault: Vault, pathSuffix: string) {
  for (const file of vault.getFiles()) {
    if (file.path.endsWith(pathSuffix)) {
      return file.path;
    }
  }
  return pathSuffix;
}

/**
 * Gets resource URI Obsidian can render.
 * @param vault Vault which contains the note.
 * @param mediaSrc src in containing span, something like a filename or path.
 * @returns URI
 */
 const getMediaUri = (
  vault: Vault,
  mediaSrc: string,
) => ([
  'app://local',
  // @ts-ignore: This just works.
  vault.adapter.basePath,
  mediaSrc,
].join('/'));

/**
 * Gets note URI that Obsidian can open.
 * @param vault Vault which contains the note.
 * @param noteHref href of link, something like a relative note path or base name.
 * @returns URI
 */
const getNoteUri = (
  vault: Vault,
  noteHref: string,
) => ([
  'obsidian://open?vault=',
  encodeURIComponent(vault.getName()),
  '&file=',
  encodeURIComponent(noteHref),
].join(''));

/**
 * Determines embed type based on src of the span element containing an embed.
 * @param node The span embed container.
 * @returns One of the plugin's recognized embed types.
 */
function determineEmbedType(node: Element): EmbedType {
  const src = node.getAttribute('src')
  if (!src) {
    return EmbedType.Unknown;
  }
  for (const [embedTypeKey, embedTypeRegex] of Object.entries(embedTypeToSrcRegex)) {
    if (src.match(embedTypeRegex as RegExp)) {
      return EmbedType[embedTypeKey];
    }
  }
  // Markdown embeds don't have an extension.
  return EmbedType.Note;
}

/**
 * Renders markdown into conatinerEl.
 */
export async function renderMarkdown(
  markdown: string,
  containerEl: HTMLElement,
  sourcePath: string,
  lifecycleComponent: Component,
  vault: Vault,
) {
  await MarkdownPreviewView.renderMarkdown(
    markdown,
    containerEl,
    sourcePath,
    lifecycleComponent,
  );
  const nodes = containerEl.querySelectorAll('span.internal-embed');
  nodes.forEach((node) => {
    const embedType = determineEmbedType(node);
    if (embedType === EmbedType.Image) {
      const img = createEl('img');
      img.src = getMediaUri(
        vault,
        getFirstMatchingFilePath(vault, node.getAttribute('src') as string),
      );
      node.empty();
      node.appendChild(img);
    }
    else if (embedType === EmbedType.Audio) {
      const audio = createEl('audio');
      audio.controls = true;
      audio.src = getMediaUri(
        vault,
        getFirstMatchingFilePath(vault, node.getAttribute('src') as string));
      node.empty();
      node.appendChild(audio);
    }
    else if (embedType === EmbedType.Video) {
      const video = createEl('video');
      video.controls = true;
      video.src = getMediaUri(
        vault,
        getFirstMatchingFilePath(vault, node.getAttribute('src') as string));
      node.empty();
      node.appendChild(video);
    }
    else if (embedType === EmbedType.PDF) {
      const iframe = createEl('iframe');
      iframe.src = getMediaUri(
        vault,
        getFirstMatchingFilePath(vault, node.getAttribute('src') as string));
      iframe.width = '100%';
      iframe.height = '800px';
      node.empty();
      node.appendChild(iframe);
    }
    else if (embedType === EmbedType.Note) {
      console.error('Repeat Plugin: Embedded notes are not yet supported.')
    }
    else {
      console.error('Repeat Plugin: Could not determine embedding type for element:');
      console.error(node);
    }
  });

  const links = containerEl.querySelectorAll('a.internal-link');
  links.forEach((node: HTMLLinkElement) => {
    if (!node.getAttribute('href')) {
      return;
    }
    node.href = getNoteUri(vault, node.getAttribute('href') as string);
  });
}

/**
 * Renders note title and link to note based on Obsidian's embed styles.
 */
export async function renderTitleElement(
  container: HTMLElement,
  file: TFile,
  vault: Vault,
) {
  const embedTitle = createEl('div', { cls: [
    'markdown-embed-title',
    'repeat-markdown_embed_title',
  ]});
  embedTitle.setText(file.basename);

  // This element is a div in Obsidian's own embed, but that makes clicking
  // to open the note more complicated. So, we use a simple link.
  const embedLink = createEl('a', { cls: 'markdown-embed-link' });
  embedLink.href = getNoteUri(vault, file.path);
  setIcon(embedLink, 'link', 20);

  container.appendChild(embedTitle);
  container.appendChild(embedLink);
}
