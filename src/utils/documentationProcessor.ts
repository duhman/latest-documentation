import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { MarkdownGenerator, formatCodeBlock, formatNote, formatWarning } from './markdownGenerator';
import { FirecrawlClient } from './firecrawl';

interface DocumentationSource {
  url: string;
  title: string;
  content: string;
  lastUpdated?: string;
}

export class DocumentationError extends Error {
  constructor(
    message: string,
    public readonly code: 'FETCH_ERROR' | 'PARSE_ERROR' | 'NO_CONTENT' | 'INVALID_SOURCE' | 'EXTRACTION_ERROR' | 'PROCESSING_ERROR',
    public readonly sourceUrl?: string
  ) {
    super(message);
    this.name = 'DocumentationError';
  }
}

export class DocumentationProcessor {
  private firecrawl: FirecrawlClient;
  private maxRetries: number;
  private retryDelay: number;

  constructor(maxRetries = 3, retryDelay = 1000) {
    this.firecrawl = new FirecrawlClient();
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  private async searchDocumentation(): Promise<string[]> {
    // Updated documentation URLs mapping
    const documentationUrls: Record<string, string[]> = {
      'hubspot': [
        'https://developers.hubspot.com/docs/api/conversations/v3/threads',
        'https://developers.hubspot.com/docs/api/crm/tickets',
        'https://developers.hubspot.com/docs/api/crm/associations/v4',
      ],
      'stripe': [
        'https://stripe.com/docs/api',
        'https://stripe.com/docs/development/quickstart',
      ],
      'github': [
        'https://docs.github.com/en/rest',
        'https://docs.github.com/en/rest/overview/resources-in-the-rest-api',
      ],
      // Add more products here
    };

    const urls = documentationUrls['hubspot'] || [];
    if (urls.length === 0) {
      throw new DocumentationError(
        `No documentation sources found for ${'hubspot'}. Supported products: ${Object.keys(documentationUrls).join(', ')}`,
        'INVALID_SOURCE'
      );
    }

    return urls;
  }

  private getHubSpotExtractors() {
    return {
      endpoints: {
        selector: '.api-docs-section',
        multiple: true,
        extract: {
          title: '.api-docs-title',
          method: '.api-docs-method',
          path: '.api-docs-path',
          description: '.api-docs-description',
          parameters: {
            selector: '.api-docs-parameters table tr',
            multiple: true,
            extract: {
              name: 'td:nth-child(1)',
              type: 'td:nth-child(2)',
              description: 'td:nth-child(3)',
              required: {
                selector: 'td:nth-child(2)',
                transform: (el) => el.textContent?.toLowerCase().includes('required') ? 'Yes' : 'No'
              }
            }
          },
          requestBody: {
            selector: '.api-docs-request',
            optional: true,
            extract: {
              description: '.api-docs-description',
              example: 'pre code'
            }
          },
          responses: {
            selector: '.api-docs-response',
            multiple: true,
            extract: {
              status: '.api-docs-status',
              description: '.api-docs-description',
              example: 'pre code'
            }
          }
        }
      }
    };
  }

  private cleanupText(text: string): string {
    // Remove cookie notices and common UI text
    text = text.replace(/We use cookies[^.]*.(\s|.)*?Cookie Policy\./g, '');
    text = text.replace(/Accept all|Decline all|Manage Cookies/g, '');
    
    // Remove JavaScript code
    text = text.replace(/\(function\([^)]*\)[^}]*\}\)\(\);?/g, '');
    text = text.replace(/window\.parent\.document/g, '');
    text = text.replace(/document\.currentScript/g, '');
    text = text.replace(/catch\(n\)\{\}/g, '');
    
    // Remove navigation text
    text = text.replace(/Go back to[^.]*/g, '');
    text = text.replace(/Skip to main content/g, '');
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  private parseRawText(text: string): string {
    // Initial cleanup
    text = this.cleanupText(text);
    
    // Split into sections based on common API documentation patterns
    const sections = text.split(/(?=GET |POST |PUT |PATCH |DELETE |Properties |Parameters |Request Body |Response |Associations)/i);
    let markdown = '';
    let inCodeBlock = false;

    sections.forEach(section => {
      const cleaned = section.trim();
      if (!cleaned) return;

      // Check if this is an API endpoint section
      const endpointMatch = cleaned.match(/^(GET|POST|PUT|PATCH|DELETE)\s+([^\s]+)/i);
      if (endpointMatch) {
        markdown += `\n### ${endpointMatch[1]} ${endpointMatch[2]}\n\n`;
        
        // Get the description part (everything after the endpoint until the next section)
        const description = cleaned.substring(endpointMatch[0].length).trim();
        if (description) {
          markdown += `${description}\n\n`;
        }
        return;
      }

      // Check if this is a code example
      if (cleaned.includes('Example request') || cleaned.includes('Copy code')) {
        const codeMatch = cleaned.match(/\{[\s\S]*\}/);
        if (codeMatch) {
          markdown += '```json\n' + codeMatch[0].trim() + '\n```\n\n';
          return;
        }
      }

      // Check if this is a section header
      const headerMatch = cleaned.match(/^(Properties|Parameters|Request Body|Response|Associations)/i);
      if (headerMatch) {
        markdown += `\n## ${headerMatch[0]}\n\n`;
        
        // Add the content after the header
        const content = cleaned.substring(headerMatch[0].length).trim();
        if (content) {
          markdown += `${content}\n\n`;
        }
        return;
      }

      // Regular content
      if (cleaned.length > 10 && !cleaned.includes('script') && !cleaned.includes('window.')) {
        markdown += `${cleaned}\n\n`;
      }
    });

    return markdown;
  }

  private async processDocumentation(url: string): Promise<string> {
    try {
      const client = new FirecrawlClient();
      const content = await client.crawl(url, {
        waitForTimeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        extractors: {
          content: {
            selector: 'main, article, .documentation-content',
            transform: (el) => el.textContent || ''
          }
        }
      });

      if (!content.content || content.content.trim().length < 100) {
        console.warn(`No content found for ${url}, content length: ${content.content?.length || 0}`);
        throw new DocumentationError('No content found', 'NO_CONTENT', url);
      }

      // Post-process the content
      let finalContent = content.content
        // Remove any remaining JavaScript-like content
        .replace(/\(\s*function\s*\([^)]*\)[^}]*\}/g, '')
        .replace(/window\.[^;]*/g, '')
        .replace(/document\.[^;]*/g, '')
        // Remove cookie notices
        .replace(/We use cookies[^.]*.(\s|.)*?Cookie Policy\./g, '')
        // Clean up markdown
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n(#{1,3})/g, '\n\n$1')
        .replace(/\n\s*```/g, '\n\n```')
        .replace(/```\s*\n/g, '```\n\n')
        .trim();

      // Validate final content
      if (finalContent.trim().length < 100) {
        console.warn(`Processed content too short for ${url}, length: ${finalContent.length}`);
        throw new DocumentationError('Processed content too short', 'NO_CONTENT', url);
      }

      return finalContent;
    } catch (error) {
      console.error(`Failed to process documentation from ${url}:`, error);
      throw new DocumentationError('Failed to process documentation', 'PROCESSING_ERROR', url);
    }
  }

  private cleanAndFormatText(text: string): string {
    // Remove extra whitespace and normalize line endings
    let cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Split into sentences for better readability
    cleaned = cleaned.replace(/\. /g, '.\n\n');
    
    // Format code snippets
    cleaned = cleaned.replace(/\{\{(.*?)\}\}/g, '```json\n$1\n```');
    
    // Clean up JSON/code snippets
    cleaned = cleaned.replace(/Copy code/g, '');
    
    // Format URLs
    cleaned = cleaned.replace(/(https?:\/\/[^\s]+)/g, '<$1>');
    
    // Clean up common artifacts
    cleaned = cleaned.replace(/\]\s*\[/g, '] [');
    cleaned = cleaned.replace(/\s*\|\s*/g, ' | ');
    
    return cleaned;
  }

  private formatEndpoint(text: string): string {
    // Extract and format HTTP method and endpoint
    const methodMatch = text.match(/(GET|POST|PUT|PATCH|DELETE)\s+([^\s]+)/);
    if (methodMatch) {
      return `### ${methodMatch[1]} ${methodMatch[2]}\n\n`;
    }
    return '';
  }

  public async generateDocumentation(productName: string, requirements?: string): Promise<string> {
    const urls = this.getDocumentationUrls(productName, requirements);
    
    try {
      const markdowns = await Promise.all(urls.map(url => this.processDocumentation(url)));
      const combinedMarkdown = markdowns.filter(md => md.trim().length > 0).join('\n');
      
      if (!combinedMarkdown) {
        throw new DocumentationError(
          'Failed to generate documentation from any source. Please try a different product or check if the documentation is accessible.',
          'NO_CONTENT'
        );
      }

      return `# ${productName} API Documentation\n\n${combinedMarkdown}`;
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError('Failed to generate documentation', 'PROCESSING_ERROR');
    }
  }

  private getDocumentationUrls(productName: string, requirements?: string): string[] {
    // Updated documentation URLs mapping
    const documentationUrls: Record<string, string[]> = {
      'hubspot': [
        'https://developers.hubspot.com/docs/api/conversations/v3/threads',
        'https://developers.hubspot.com/docs/api/crm/tickets',
        'https://developers.hubspot.com/docs/api/crm/associations/v4',
      ],
      'stripe': [
        'https://stripe.com/docs/api',
        'https://stripe.com/docs/development/quickstart',
      ],
      'github': [
        'https://docs.github.com/en/rest',
        'https://docs.github.com/en/rest/overview/resources-in-the-rest-api',
      ],
      // Add more products here
    };

    return documentationUrls[productName] || [];
  }
}
