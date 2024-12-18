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
        'https://app.hubspot.com/developer-docs/api/conversations/v3/threads',
        'https://app.hubspot.com/developer-docs/api/crm/tickets',
        'https://app.hubspot.com/developer-docs/api/crm/associations/v4',
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

  async processDocumentation(url: string): Promise<string> {
    try {
      // Configure crawl options based on the URL
      const options = this.getCrawlOptions(url);
      
      // Use Firecrawl to extract content
      const content = await this.firecrawl.crawl(url, options);
      
      if (!content) {
        throw new DocumentationError(
          'No content could be extracted from the documentation page.',
          'EXTRACTION_ERROR',
          url
        );
      }

      return this.formatContent(content, url);
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError(
        `Failed to process documentation: ${error.message}`,
        'PROCESSING_ERROR',
        url
      );
    }
  }

  private getCrawlOptions(url: string) {
    const isHubSpot = url.includes('app.hubspot.com/developer-docs');
    
    return {
      waitForSelectors: isHubSpot ? [
        '[data-test-id="endpoint"]',
        '[data-test-id="overview"]'
      ] : undefined,
      waitForTimeout: isHubSpot ? 2000 : 1000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      extractors: isHubSpot ? this.getHubSpotExtractors() : this.getDefaultExtractors(),
    };
  }

  private getHubSpotExtractors() {
    return {
      endpoints: {
        selector: '[data-test-id="endpoint"]',
        multiple: true,
        extract: {
          method: '[data-test-id="method"]',
          path: '[data-test-id="path"]',
          description: '[data-test-id="description"]',
          parameters: {
            selector: '[data-test-id="parameter"]',
            multiple: true,
            extract: {
              name: '[data-test-id="name"]',
              type: '[data-test-id="type"]',
              required: {
                selector: '[data-test-id="required"]',
                transform: (el) => el ? 'Yes' : 'No'
              },
              description: '[data-test-id="description"]'
            }
          },
          examples: {
            selector: '[data-test-id="example"]',
            multiple: true,
            extract: {
              title: '[data-test-id="title"]',
              code: 'pre, code'
            }
          }
        }
      },
      overview: {
        selector: '[data-test-id="overview"]',
        optional: true
      }
    };
  }

  private getDefaultExtractors() {
    return {
      content: {
        selector: 'article, main, .content, .documentation',
        transform: (el) => {
          // Remove navigation, headers, footers etc.
          el.querySelectorAll('.navigation, .nav, .search, .sidebar, .footer, .header').forEach(node => node.remove());
          return el.textContent;
        }
      }
    };
  }

  private formatContent(content: any, url: string): string {
    if (url.includes('app.hubspot.com/developer-docs')) {
      return this.formatHubSpotContent(content);
    }
    return this.formatDefaultContent(content);
  }

  private formatHubSpotContent(content: any): string {
    let markdown = '';

    // Add overview if present
    if (content.overview) {
      markdown += `${content.overview}\n\n---\n\n`;
    }

    // Format endpoints
    if (content.endpoints) {
      content.endpoints.forEach((endpoint: any) => {
        markdown += `### ${endpoint.method} ${endpoint.path}\n\n`;
        
        if (endpoint.description) {
          markdown += `${endpoint.description}\n\n`;
        }

        if (endpoint.parameters?.length > 0) {
          markdown += '#### Parameters\n\n';
          markdown += '| Name | Type | Required | Description |\n';
          markdown += '|------|------|----------|-------------|\n';
          
          endpoint.parameters.forEach((param: any) => {
            markdown += `| ${param.name} | ${param.type || '-'} | ${param.required} | ${param.description || '-'} |\n`;
          });
          markdown += '\n';
        }

        if (endpoint.examples?.length > 0) {
          endpoint.examples.forEach((example: any) => {
            markdown += `#### ${example.title || 'Example'}\n\n`;
            markdown += '```json\n' + example.code + '\n```\n\n';
          });
        }

        markdown += '---\n\n';
      });
    }

    return markdown.trim();
  }

  private formatDefaultContent(content: any): string {
    if (typeof content === 'string') {
      return content.trim();
    }
    return content.content.trim();
  }

  async generateDocumentation(): Promise<string> {
    try {
      // 1. Get documentation URLs
      const urls = await this.searchDocumentation();

      // 2. Crawl all pages
      const sourcesPromises = urls.map(url => 
        this.processDocumentation(url).catch(error => {
          console.error(`Failed to process ${url}:`, error);
          return null;
        })
      );

      const sources = (await Promise.all(sourcesPromises)).filter((source): source is string => source !== null);

      if (sources.length === 0) {
        throw new DocumentationError(
          'Failed to generate documentation from any source. Please try a different product or check if the documentation is accessible.',
          'NO_CONTENT'
        );
      }

      // 3. Generate markdown
      const markdownGenerator = new MarkdownGenerator({
        product: 'hubspot',
        generatedAt: new Date().toISOString(),
        requirements: '',
        sources: urls,
      });

      const sections = sources.map((source, index) => ({
        title: `Documentation ${index + 1}`,
        content: source,
        sourceUrl: urls[index],
        timestamp: '',
      }));

      return markdownGenerator.generateMarkdown(sections);
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
