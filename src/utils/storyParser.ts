import mammoth from 'mammoth';
import { StoryItem } from '../types';

/**
 * Extracts raw text from uploaded Word (.docx, .doc) or Text (.txt) file
 */
export async function extractTextFromWordFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value || '';
    } catch (err) {
      console.error('Error extracting text from docx:', err);
      return await file.text();
    }
  } else {
    return await file.text();
  }
}

/**
 * Parses raw text into multiple StoryItems based on Titles and Stories structure.
 * Supports:
 * - Line starting with Title / Title: / # / [Title] / গল্প
 * - First line of double-line-break paragraph block as Title
 * - Sequential line-by-line title/story detection
 */
export function parseStoriesFromRawText(rawText: string, courseId: string = 'course'): StoryItem[] {
  if (!rawText || !rawText.trim()) return [];

  const stories: StoryItem[] = [];

  const isTitleMarker = (line: string): boolean => {
    const clean = line.trim();
    if (!clean) return false;
    if (/^(title|story|topic|chapter|golpho|গল্প|শিরোনাম)[\s:-]+/i.test(clean)) return true;
    if (/^#+\s+/.test(clean)) return true;
    if (/^\[.+\]$/.test(clean)) return true;
    return false;
  };

  const cleanTitleText = (raw: string): string => {
    return raw
      .replace(/^(title|story|topic|chapter|golpho|গল্প|শিরোনাম)[\s:-]+/i, '')
      .replace(/^#+\s+/, '')
      .replace(/^\[|\]$/g, '')
      .trim();
  };

  // Divide raw text into double-linebreak paragraphs
  const blocks = rawText.split(/\r?\n\s*\r?\n+/).map(b => b.trim()).filter(Boolean);

  if (blocks.length > 0) {
    let currentTitle = '';
    let currentContent: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const linesInBlock = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      const firstLine = linesInBlock[0] || '';
      
      // Check if block's first line is an explicit title marker or a short title-like line
      const firstLineIsTitle = isTitleMarker(firstLine) || (
        linesInBlock.length > 1 && 
        firstLine.length <= 80 && 
        !/[.!?।]$/.test(firstLine)
      );

      if (firstLineIsTitle) {
        // If we already had a title & content accumulated, save that story first
        if (currentTitle && currentContent.length > 0) {
          stories.push({
            id: `story-${courseId}-${Date.now()}-${stories.length + 1}`,
            title: currentTitle,
            content: currentContent.join('\n\n'),
            createdAt: new Date().toISOString()
          });
          currentContent = [];
        }

        currentTitle = cleanTitleText(firstLine);
        const storyBodyInBlock = linesInBlock.slice(1).join('\n');
        if (storyBodyInBlock) {
          currentContent.push(storyBodyInBlock);
        }
      } else if (isTitleMarker(firstLine) || (linesInBlock.length === 1 && firstLine.length <= 80 && !/[.!?।]$/.test(firstLine))) {
        // Standalone title block
        if (currentTitle && currentContent.length > 0) {
          stories.push({
            id: `story-${courseId}-${Date.now()}-${stories.length + 1}`,
            title: currentTitle,
            content: currentContent.join('\n\n'),
            createdAt: new Date().toISOString()
          });
          currentContent = [];
        }
        currentTitle = cleanTitleText(firstLine);
      } else {
        // Story content block
        if (!currentTitle) {
          // If no title yet, treat first line as title
          if (firstLine.length <= 80) {
            currentTitle = cleanTitleText(firstLine);
            const remaining = linesInBlock.slice(1).join('\n');
            if (remaining) currentContent.push(remaining);
          } else {
            currentTitle = `Story ${stories.length + 1}`;
            currentContent.push(block);
          }
        } else {
          currentContent.push(block);
        }
      }
    }

    if (currentTitle && currentContent.length > 0) {
      stories.push({
        id: `story-${courseId}-${Date.now()}-${stories.length + 1}`,
        title: currentTitle,
        content: currentContent.join('\n\n'),
        createdAt: new Date().toISOString()
      });
    }
  }

  // Fallback if parsing produced nothing
  if (stories.length === 0 && rawText.trim()) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const titleCandidate = lines[0] || 'Story 1';
    stories.push({
      id: `story-${courseId}-${Date.now()}-1`,
      title: titleCandidate.length <= 80 ? cleanTitleText(titleCandidate) : 'Untitled Story',
      content: titleCandidate.length <= 80 ? lines.slice(1).join('\n') : rawText,
      createdAt: new Date().toISOString()
    });
  }

  return stories;
}
