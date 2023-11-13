import { Component, MarkdownPreviewView, Vault, setIcon, TFile, Platform } from 'obsidian';

enum EmbedType {
  Image = 'Image',
  Audio = 'Audio',
  Video = 'Video',
  PDF = 'PDF',
  Note = 'Note',
  Unknown = 'Unknown',
}

// https://help.obsidian.md/Files+and+folders/Accepted+file+formats
const embedTypeToAcceptedExtensions = {
  [EmbedType.Image]: ['png', 'webp', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'],
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
 * @param mediaSrc Path suffix of file to display.
 * @returns Full path of file, or just pathSuffix if no file matched.
 */
function getClosestMatchingFilePath(
  vault: Vault,
  mediaSrc: string,
  containingNotePath: string,
) {
  const containingDir = (() => {
    const parts = containingNotePath.split('/');
    parts.pop();
    return parts.join('/');
  })();
  let normalizedPathSuffix = mediaSrc;
  if (mediaSrc.startsWith('.')) {
    const resourcePathParts = containingNotePath.split('/');
    // Remove the note file name.
    resourcePathParts.pop();
    for (const suffixPart of mediaSrc.split('/')) {
      if (suffixPart === '..') {
        resourcePathParts.pop();
      }
      else if (suffixPart === '.') {
        continue;
      } else {
        resourcePathParts.push(suffixPart);
      }
    }
    normalizedPathSuffix = resourcePathParts.join('/');
  }

  // Keep track of all matches to choose between later.
  // This is only useful if multiple folders contain the same file name.
  const allMatches: string[] = [];
  for (const file of vault.getFiles()) {
    if (file.path.endsWith(normalizedPathSuffix)) {
      // End things right away if we have an exact match.
      if (file.path === normalizedPathSuffix) {
        return file.path;
      }
      allMatches.push(file.path);
    }
  }
  // Matches closer to note are prioritized over alphanumeric sorting.
  allMatches.sort((left, right) => {
    if (left.startsWith(containingDir) && !right.startsWith(containingDir)) {
      return -1
    }
    if (right.startsWith(containingDir) && !left.startsWith(containingDir)) {
      return 1;
    }
    return (left <= right) ? -1 : 1;
  });
  if (allMatches) {
    return allMatches[0];
  }
  // No matches probably means a broken link.
  return mediaSrc;
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
  containingNotePath: string,
) => {
  const matchingPath = getClosestMatchingFilePath(vault, mediaSrc, containingNotePath);
  return vault.adapter.getResourcePath(matchingPath);
}

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
 * Renders markdown into outerContainer.
 */
export async function renderMarkdown(
  markdown: string,
  outerContainer: HTMLElement,
  sourcePath: string,
  lifecycleComponent: Component,
  vault: Vault,
) {
  const innerContainer = createEl('div', {
    cls: ['markdown-preview-view', 'markdown-rendered'],
  });
  const contentContainer = createEl('div', {
    cls: ['markdown-preview-sizer markdown-preview-section'],
  });
  outerContainer.appendChild(innerContainer);
  innerContainer.appendChild(contentContainer);
  await MarkdownPreviewView.renderMarkdown(
    markdown,
    contentContainer,
    sourcePath,
    lifecycleComponent,
  );
  const nodes = contentContainer.querySelectorAll('span.internal-embed');
  nodes.forEach((node) => {
    const embedType = determineEmbedType(node);
    if (embedType === EmbedType.Image) {
      const img = createEl('img');
      img.src = getMediaUri(
        vault,
        node.getAttribute('src') as string,
        sourcePath);
      node.empty();
      node.appendChild(img);
    }
    else if (embedType === EmbedType.Audio) {
      const audio = createEl('audio');
      audio.controls = true;
      audio.src = getMediaUri(
        vault,
        node.getAttribute('src') as string,
        sourcePath);
      node.empty();
      node.appendChild(audio);
    }
    else if (embedType === EmbedType.Video) {
      const video = createEl('video');
      video.controls = true;
      video.src = getMediaUri(
        vault,
        node.getAttribute('src') as string,
        sourcePath);
      node.empty();
      node.appendChild(video);
    }
    else if (embedType === EmbedType.PDF) {
      if (!Platform.isDesktop) {
        console.error(
          'Repeat Plugin: Embedded PDFs are only supported on the desktop.')
        return;
      }
      const iframe = createEl('iframe');
      iframe.src = getMediaUri(
        vault,
        node.getAttribute('src') as string,
        sourcePath);
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

  const links = contentContainer.querySelectorAll('a.internal-link');
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
    'embed-title',
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
