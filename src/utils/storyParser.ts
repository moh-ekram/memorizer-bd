import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { StoryItem, ArticleItem } from '../types';

/**
 * Extracts raw text from uploaded Word (.docx, .doc) or Text (.txt, .md) file
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

const isTitleMarker = (line: string): boolean => {
  const clean = line.trim();
  if (!clean) return false;
  if (/^(title|story|article|topic|chapter|golpho|গল্প|আর্টিকেল|প্রবন্ধ|শিরোনাম)[\s:-]+/i.test(clean)) return true;
  if (/^#+\s+/.test(clean)) return true;
  if (/^\[.+\]$/.test(clean)) return true;
  return false;
};

const cleanTitleText = (raw: string): string => {
  return raw
    .replace(/^(title|story|article|topic|chapter|golpho|গল্প|আর্টিকেল|প্রবন্ধ|শিরোনাম)[\s:-]+/i, '')
    .replace(/^#+\s+/, '')
    .replace(/^\[|\]$/g, '')
    .trim();
};

/**
 * Parses raw text into multiple StoryItems based on Titles and Stories structure.
 */
export function parseStoriesFromRawText(rawText: string, courseId: string = 'course'): StoryItem[] {
  if (!rawText || !rawText.trim()) return [];

  const stories: StoryItem[] = [];
  const blocks = rawText.split(/\r?\n\s*\r?\n+/).map(b => b.trim()).filter(Boolean);

  if (blocks.length > 0) {
    let currentTitle = '';
    let currentContent: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const linesInBlock = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const firstLine = linesInBlock[0] || '';
      
      const firstLineIsTitle = isTitleMarker(firstLine) || (
        linesInBlock.length > 1 && 
        firstLine.length <= 80 && 
        !/[.!?।]$/.test(firstLine)
      );

      if (firstLineIsTitle) {
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
        if (!currentTitle) {
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

/**
 * Universal Story Parser supporting Word (.docx, .doc), Excel/CSV (.xlsx, .xls, .csv), JSON (.json), and Text (.txt, .md)
 */
export async function parseStoriesFromFile(file: File, courseId: string = 'course'): Promise<StoryItem[]> {
  const fileName = file.name.toLowerCase();

  // 1. JSON file
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawArray = Array.isArray(parsed) ? parsed : (parsed.stories || parsed.items || parsed.data || []);
    if (!Array.isArray(rawArray)) throw new Error('Invalid JSON format for stories');
    return rawArray.map((item: any, idx: number) => ({
      id: String(item.id || `story-${courseId}-${Date.now()}-${idx + 1}`),
      title: String(item.title || item.heading || item.name || `Story ${idx + 1}`),
      content: String(item.content || item.story || item.text || item.body || ''),
      createdAt: item.createdAt || new Date().toISOString()
    })).filter(s => s.content.trim() || s.title.trim());
  }

  // 2. Excel / CSV file
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = wb.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    return rows.map((row, idx) => {
      // Find title column
      const titleKey = Object.keys(row).find(k => /^(title|heading|topic|name|শিরোনাম|গল্প|story)/i.test(k.trim())) || Object.keys(row)[0];
      const contentKey = Object.keys(row).find(k => /^(content|story|body|text|details|description|গল্পের_লেখা)/i.test(k.trim())) || Object.keys(row)[1];

      const title = String(row[titleKey] || `Story ${idx + 1}`).trim();
      const content = String(row[contentKey] || (titleKey && row[titleKey] !== title ? row[titleKey] : '')).trim();

      return {
        id: `story-${courseId}-${Date.now()}-${idx + 1}`,
        title: title || `Story ${idx + 1}`,
        content: content || title,
        createdAt: new Date().toISOString()
      };
    }).filter(s => s.content.trim() || s.title.trim());
  }

  // 3. Word document (.docx, .doc) or Text (.txt, .md)
  const rawText = await extractTextFromWordFile(file);
  return parseStoriesFromRawText(rawText, courseId);
}

/**
 * Parses raw text into multiple ArticleItems.
 */
export function parseArticlesFromRawText(rawText: string, courseId: string = 'course'): ArticleItem[] {
  if (!rawText || !rawText.trim()) return [];

  const articles: ArticleItem[] = [];
  const blocks = rawText.split(/\r?\n\s*\r?\n+/).map(b => b.trim()).filter(Boolean);

  const gradients = [
    'from-indigo-600 via-purple-600 to-pink-600',
    'from-blue-600 via-cyan-600 to-teal-600',
    'from-emerald-600 via-teal-600 to-cyan-600',
    'from-violet-600 via-fuchsia-600 to-rose-600',
    'from-amber-600 via-orange-600 to-rose-600'
  ];

  if (blocks.length > 0) {
    let currentTitle = '';
    let currentExcerpt = '';
    let currentCategory = 'Vocabulary Reading';
    let currentAuthor = 'Course Educator';
    let currentContent: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const linesInBlock = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const firstLine = linesInBlock[0] || '';

      // Check if block defines explicit metadata
      let isMetaBlock = false;
      linesInBlock.forEach(line => {
        if (/^author[\s:-]+/i.test(line)) {
          currentAuthor = line.replace(/^author[\s:-]+/i, '').trim();
          isMetaBlock = true;
        }
        if (/^category[\s:-]+/i.test(line)) {
          currentCategory = line.replace(/^category[\s:-]+/i, '').trim();
          isMetaBlock = true;
        }
        if (/^(excerpt|summary|বিবরণ)[\s:-]+/i.test(line)) {
          currentExcerpt = line.replace(/^(excerpt|summary|বিবরণ)[\s:-]+/i, '').trim();
          isMetaBlock = true;
        }
      });

      if (isMetaBlock && linesInBlock.length <= 4) {
        continue;
      }

      const firstLineIsTitle = isTitleMarker(firstLine) || (
        linesInBlock.length > 1 && 
        firstLine.length <= 90 && 
        !/[.!?।]$/.test(firstLine)
      );

      if (firstLineIsTitle) {
        if (currentTitle && currentContent.length > 0) {
          const bodyText = currentContent.join('\n\n');
          const wordsCount = bodyText.split(/\s+/).length;
          const readTime = `${Math.max(1, Math.ceil(wordsCount / 180))} min read`;
          const autoExcerpt = currentExcerpt || (bodyText.length > 140 ? bodyText.slice(0, 140).trim() + '...' : bodyText);

          articles.push({
            id: `art-${courseId}-${Date.now()}-${articles.length + 1}`,
            title: currentTitle,
            excerpt: autoExcerpt,
            content: bodyText,
            author: currentAuthor,
            category: currentCategory,
            readTime: readTime,
            publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            coverGradient: gradients[articles.length % gradients.length],
            tags: ['Vocabulary', 'Article'],
            createdAt: new Date().toISOString()
          });

          currentContent = [];
          currentExcerpt = '';
          currentAuthor = 'Course Educator';
          currentCategory = 'Vocabulary Reading';
        }

        currentTitle = cleanTitleText(firstLine);
        const articleBodyInBlock = linesInBlock.slice(1).join('\n');
        if (articleBodyInBlock) {
          currentContent.push(articleBodyInBlock);
        }
      } else if (isTitleMarker(firstLine) || (linesInBlock.length === 1 && firstLine.length <= 90 && !/[.!?।]$/.test(firstLine))) {
        if (currentTitle && currentContent.length > 0) {
          const bodyText = currentContent.join('\n\n');
          const wordsCount = bodyText.split(/\s+/).length;
          const readTime = `${Math.max(1, Math.ceil(wordsCount / 180))} min read`;
          const autoExcerpt = currentExcerpt || (bodyText.length > 140 ? bodyText.slice(0, 140).trim() + '...' : bodyText);

          articles.push({
            id: `art-${courseId}-${Date.now()}-${articles.length + 1}`,
            title: currentTitle,
            excerpt: autoExcerpt,
            content: bodyText,
            author: currentAuthor,
            category: currentCategory,
            readTime: readTime,
            publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            coverGradient: gradients[articles.length % gradients.length],
            tags: ['Vocabulary', 'Article'],
            createdAt: new Date().toISOString()
          });

          currentContent = [];
          currentExcerpt = '';
        }
        currentTitle = cleanTitleText(firstLine);
      } else {
        if (!currentTitle) {
          if (firstLine.length <= 90) {
            currentTitle = cleanTitleText(firstLine);
            const remaining = linesInBlock.slice(1).join('\n');
            if (remaining) currentContent.push(remaining);
          } else {
            currentTitle = `Article ${articles.length + 1}`;
            currentContent.push(block);
          }
        } else {
          currentContent.push(block);
        }
      }
    }

    if (currentTitle && currentContent.length > 0) {
      const bodyText = currentContent.join('\n\n');
      const wordsCount = bodyText.split(/\s+/).length;
      const readTime = `${Math.max(1, Math.ceil(wordsCount / 180))} min read`;
      const autoExcerpt = currentExcerpt || (bodyText.length > 140 ? bodyText.slice(0, 140).trim() + '...' : bodyText);

      articles.push({
        id: `art-${courseId}-${Date.now()}-${articles.length + 1}`,
        title: currentTitle,
        excerpt: autoExcerpt,
        content: bodyText,
        author: currentAuthor,
        category: currentCategory,
        readTime: readTime,
        publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        coverGradient: gradients[articles.length % gradients.length],
        tags: ['Vocabulary', 'Article'],
        createdAt: new Date().toISOString()
      });
    }
  }

  // Fallback
  if (articles.length === 0 && rawText.trim()) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const titleCandidate = lines[0] || 'Article 1';
    const body = titleCandidate.length <= 90 ? lines.slice(1).join('\n') : rawText;
    articles.push({
      id: `art-${courseId}-${Date.now()}-1`,
      title: titleCandidate.length <= 90 ? cleanTitleText(titleCandidate) : 'Untitled Article',
      excerpt: body.slice(0, 140) + '...',
      content: body || titleCandidate,
      author: 'Course Educator',
      category: 'Vocabulary Reading',
      readTime: '3 min read',
      publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      coverGradient: 'from-indigo-600 via-purple-600 to-pink-600',
      tags: ['Vocabulary', 'Article'],
      createdAt: new Date().toISOString()
    });
  }

  return articles;
}

/**
 * Universal Article Parser supporting Word (.docx, .doc), Excel/CSV (.xlsx, .xls, .csv), JSON (.json), and Text (.txt, .md)
 */
export async function parseArticlesFromFile(file: File, courseId: string = 'course'): Promise<ArticleItem[]> {
  const fileName = file.name.toLowerCase();
  const gradients = [
    'from-indigo-600 via-purple-600 to-pink-600',
    'from-blue-600 via-cyan-600 to-teal-600',
    'from-emerald-600 via-teal-600 to-cyan-600',
    'from-violet-600 via-fuchsia-600 to-rose-600',
    'from-amber-600 via-orange-600 to-rose-600'
  ];

  // 1. JSON file
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawArray = Array.isArray(parsed) ? parsed : (parsed.articles || parsed.items || parsed.data || []);
    if (!Array.isArray(rawArray)) throw new Error('Invalid JSON format for articles');
    return rawArray.map((item: any, idx: number) => {
      const content = String(item.content || item.article || item.text || item.body || '');
      const wordsCount = content.split(/\s+/).length;
      return {
        id: String(item.id || `art-${courseId}-${Date.now()}-${idx + 1}`),
        title: String(item.title || item.heading || item.name || `Article ${idx + 1}`),
        excerpt: String(item.excerpt || item.summary || (content.length > 140 ? content.slice(0, 140) + '...' : content)),
        content: content,
        author: String(item.author || 'Course Educator'),
        category: String(item.category || 'Vocabulary Reading'),
        readTime: String(item.readTime || `${Math.max(1, Math.ceil(wordsCount / 180))} min read`),
        publishedAt: String(item.publishedAt || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })),
        coverGradient: String(item.coverGradient || gradients[idx % gradients.length]),
        tags: Array.isArray(item.tags) ? item.tags : ['Vocabulary', 'Article'],
        createdAt: item.createdAt || new Date().toISOString()
      };
    }).filter(a => a.content.trim() || a.title.trim());
  }

  // 2. Excel / CSV file
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = wb.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    return rows.map((row, idx) => {
      const titleKey = Object.keys(row).find(k => /^(title|heading|topic|name|শিরোনাম|আর্টিকেল|article)/i.test(k.trim())) || Object.keys(row)[0];
      const contentKey = Object.keys(row).find(k => /^(content|article|body|text|details|description|মূল_লেখা)/i.test(k.trim())) || Object.keys(row)[1];
      const excerptKey = Object.keys(row).find(k => /^(excerpt|summary|বিবরণ|সারসংক্ষেপ)/i.test(k.trim()));
      const authorKey = Object.keys(row).find(k => /^(author|writer|লেখক)/i.test(k.trim()));
      const categoryKey = Object.keys(row).find(k => /^(category|ক্যাটাগরি|বিষয়|topic)/i.test(k.trim()));

      const title = String(row[titleKey] || `Article ${idx + 1}`).trim();
      const content = String(row[contentKey] || (titleKey && row[titleKey] !== title ? row[titleKey] : '')).trim();
      const excerpt = excerptKey ? String(row[excerptKey]).trim() : (content.length > 140 ? content.slice(0, 140) + '...' : content);
      const author = authorKey ? String(row[authorKey]).trim() : 'Course Educator';
      const category = categoryKey ? String(row[categoryKey]).trim() : 'Vocabulary Reading';
      const wordsCount = (content || title).split(/\s+/).length;

      return {
        id: `art-${courseId}-${Date.now()}-${idx + 1}`,
        title: title || `Article ${idx + 1}`,
        excerpt: excerpt || title,
        content: content || title,
        author: author || 'Course Educator',
        category: category || 'Vocabulary Reading',
        readTime: `${Math.max(1, Math.ceil(wordsCount / 180))} min read`,
        publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        coverGradient: gradients[idx % gradients.length],
        tags: ['Vocabulary', 'Article'],
        createdAt: new Date().toISOString()
      };
    }).filter(a => a.content.trim() || a.title.trim());
  }

  // 3. Word document (.docx, .doc) or Text (.txt, .md)
  const rawText = await extractTextFromWordFile(file);
  return parseArticlesFromRawText(rawText, courseId);
}
