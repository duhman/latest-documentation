import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { MarkdownGenerator, formatCodeBlock, formatNote, formatWarning } from './markdownGenerator';

interface DocumentationSource {
  url: string;
  title: string;
  content: string;
  lastUpdated?: string;
}

export class DocumentationError extends Error {
  constructor(
    message: string,
    public readonly code: 'FETCH_ERROR' | 'PARSE_ERROR' | 'NO_CONTENT' | 'INVALID_SOURCE',
    public readonly sourceUrl?: string
  ) {
    super(message);
    this.name = 'DocumentationError';
  }
}

export class DocumentationProcessor {
  private product: string;
  private requirements: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor(product: string, requirements: string) {
    this.product = product.trim();
    this.requirements = requirements.trim();

    if (!this.product) {
      throw new DocumentationError('Product name is required', 'INVALID_SOURCE');
    }
  }

  private async searchDocumentation(): Promise<string[]> {
    // For now, we'll use a simple mapping of products to their documentation URLs
    const documentationUrls: Record<string, string[]> = {
      'hubspot': [
        'https://developers.hubspot.com/docs/api/overview',
        'https://developers.hubspot.com/docs/api/getting-started',
      ],
      // Add more products and their documentation URLs here
    };

    const urls = documentationUrls[this.product.toLowerCase()] || [];
    if (urls.length === 0) {
      throw new DocumentationError(
        `No documentation sources found for ${this.product}`,
        'INVALID_SOURCE'
      );
    }

    return urls;
  }

  private async fetchWithRetry(url: string, retries = this.maxRetries): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 10000, // 10 seconds timeout
        headers: {
          'User-Agent': 'Documentation-Generator/1.0',
        },
      });
      return response.data;
    } catch (error) {
      if (retries > 0 && error instanceof AxiosError && error.response?.status !== 404) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.fetchWithRetry(url, retries - 1);
      }
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 404) {
          throw new DocumentationError(`Documentation page not found: ${url}`, 'FETCH_ERROR', url);
        }
        throw new DocumentationError(
          `Failed to fetch documentation: ${error.message}`,
          'FETCH_ERROR',
          url
        );
      }
      throw error;
    }
  }

  private async crawlPage(url: string): Promise<DocumentationSource> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = cheerio.load(html);

      // Remove unnecessary elements
      $('script').remove();
      $('style').remove();
      $('nav').remove();
      $('footer').remove();
      $('header').remove();

      // Extract main content
      const title = $('h1').first().text() || $('title').text();
      let content = '';

      // Process code blocks
      $('pre code').each((_, elem) => {
        const language = $(elem).attr('class')?.replace('language-', '') || '';
        const code = $(elem).text();
        content += formatCodeBlock(code, language) + '\n\n';
      });

      // Process notes and warnings
      $('.note, .notification, .alert-info').each((_, elem) => {
        content += formatNote($(elem).text()) + '\n';
      });

      $('.warning, .alert-warning').each((_, elem) => {
        content += formatWarning($(elem).text()) + '\n';
      });

      // Process regular content
      $('main, article, .content').find('h2, h3, h4, p, ul, ol').each((_, elem) => {
        const text = $(elem).text().trim();
        if (text) {
          if (elem.name.startsWith('h')) {
            content += `\n### ${text}\n\n`;
          } else if (elem.name === 'ul' || elem.name === 'ol') {
            $(elem).find('li').each((_, li) => {
              content += `- ${$(li).text().trim()}\n`;
            });
            content += '\n';
          } else {
            content += `${text}\n\n`;
          }
        }
      });

      if (!content.trim()) {
        throw new DocumentationError(
          'No content could be extracted from the page',
          'NO_CONTENT',
          url
        );
      }

      // Try to find last updated date
      const lastUpdated = $('meta[name="last-modified"]').attr('content') ||
                         $('time[datetime]').attr('datetime') ||
                         undefined;

      return {
        url,
        title: title.trim() || 'Untitled Documentation',
        content: content.trim(),
        lastUpdated,
      };
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError(
        `Error processing documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        url
      );
    }
  }

  async generateDocumentation(): Promise<string> {
    try {
      // 1. Get documentation URLs
      const urls = await this.searchDocumentation();

      // 2. Crawl all pages
      const sourcesPromises = urls.map(url => 
        this.crawlPage(url).catch(error => {
          console.error(`Failed to process ${url}:`, error);
          return null;
        })
      );

      const sources = (await Promise.all(sourcesPromises)).filter((source): source is DocumentationSource => source !== null);

      if (sources.length === 0) {
        throw new DocumentationError(
          'Failed to generate documentation from any source',
          'NO_CONTENT'
        );
      }

      // 3. Generate markdown
      const markdownGenerator = new MarkdownGenerator({
        product: this.product,
        generatedAt: new Date().toISOString(),
        requirements: this.requirements,
        sources: urls,
      });

      const sections = sources.map(source => ({
        title: source.title,
        content: source.content,
        sourceUrl: source.url,
        timestamp: source.lastUpdated,
      }));

      const markdown = markdownGenerator.generateMarkdown(sections);

      // 4. Save to file
      const outputDir = path.join(process.cwd(), 'public', 'docs');
      const filePath = await markdownGenerator.saveToFile(outputDir);

      return filePath;
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError(
        `Failed to generate documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR'
      );
    }
  }
}
