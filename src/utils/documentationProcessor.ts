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

    const urls = documentationUrls[this.product.toLowerCase()] || [];
    if (urls.length === 0) {
      throw new DocumentationError(
        `No documentation sources found for ${this.product}. Supported products: ${Object.keys(documentationUrls).join(', ')}`,
        'INVALID_SOURCE'
      );
    }

    return urls;
  }

  private async fetchWithRetry(url: string, retries = this.maxRetries): Promise<string> {
    try {
      // Add a small delay between retries to avoid rate limiting
      if (this.maxRetries - retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (this.maxRetries - retries)));
      }

      // Special handling for HubSpot API docs
      const isHubSpotDocs = url.includes('app.hubspot.com/developer-docs');
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      };

      // Add HubSpot-specific headers
      if (isHubSpotDocs) {
        Object.assign(headers, {
          'X-HubSpot-No-Auth': '1',
          'X-HubSpot-API-Version': 'v3',
          'Referer': 'https://app.hubspot.com/',
          'Origin': 'https://app.hubspot.com',
        });
      }

      const response = await axios.get(url, {
        timeout: 15000,
        headers,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });

      // Wait for client-side rendering
      await new Promise(resolve => setTimeout(resolve, isHubSpotDocs ? 2000 : 1000));

      // For HubSpot API docs, format the JSON response as markdown
      if (isHubSpotDocs && typeof response.data === 'object') {
        return this.formatHubSpotApiDocs(response.data, url);
      }

      return response.data;
    } catch (error) {
      if (retries > 0 && error instanceof AxiosError && error.response?.status !== 404) {
        return this.fetchWithRetry(url, retries - 1);
      }
      
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        if (status === 404) {
          throw new DocumentationError(`Documentation page not found: ${url}`, 'FETCH_ERROR', url);
        } else if (status === 403) {
          throw new DocumentationError(`Access denied to documentation: ${url}. The page might require authentication.`, 'FETCH_ERROR', url);
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

  private formatHubSpotApiDocs(data: any, url: string): string {
    let content = '';

    // Add API description if available
    if (data.description) {
      content += `${data.description}\n\n`;
    }

    // Add endpoints
    if (data.paths) {
      Object.entries(data.paths).forEach(([path, methods]: [string, any]) => {
        Object.entries(methods).forEach(([method, details]: [string, any]) => {
          content += `### ${method.toUpperCase()} ${path}\n\n`;
          
          if (details.summary) {
            content += `${details.summary}\n\n`;
          }
          
          if (details.description) {
            content += `${details.description}\n\n`;
          }

          // Parameters
          if (details.parameters?.length > 0) {
            content += `#### Parameters\n\n`;
            content += '| Name | Type | Required | Description |\n';
            content += '|------|------|----------|-------------|\n';
            details.parameters.forEach((param: any) => {
              content += `| ${param.name} | ${param.type || param.schema?.type || '-'} | ${param.required ? 'Yes' : 'No'} | ${param.description || '-'} |\n`;
            });
            content += '\n';
          }

          // Request body
          if (details.requestBody?.content) {
            content += `#### Request Body\n\n`;
            const schema = details.requestBody.content['application/json']?.schema;
            if (schema) {
              if (schema.properties) {
                content += '| Property | Type | Required | Description |\n';
                content += '|----------|------|----------|-------------|\n';
                Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
                  const required = schema.required?.includes(name) ? 'Yes' : 'No';
                  content += `| ${name} | ${prop.type || '-'} | ${required} | ${prop.description || '-'} |\n`;
                });
                content += '\n';
              }
            }
          }

          // Response
          if (details.responses) {
            content += `#### Responses\n\n`;
            Object.entries(details.responses).forEach(([code, response]: [string, any]) => {
              content += `**${code}**: ${response.description || '-'}\n\n`;
              if (response.content?.['application/json']?.schema) {
                content += `Response schema:\n\`\`\`json\n${JSON.stringify(response.content['application/json'].schema, null, 2)}\n\`\`\`\n\n`;
              }
            });
          }
        });
      });
    }

    if (!content) {
      throw new DocumentationError(
        'No content could be extracted from the API documentation',
        'NO_CONTENT',
        url
      );
    }

    return content;
  }

  private async crawlPage(url: string): Promise<DocumentationSource> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = cheerio.load(html);

      // Remove unnecessary elements
      $('script, style, nav, footer, header, iframe, .cookie-banner, .advertisement').remove();

      // Extract main content
      const title = $('h1').first().text() || 
                   $('title').text() || 
                   $('meta[property="og:title"]').attr('content') ||
                   'Untitled Documentation';

      let content = '';

      // Try multiple content selectors
      const mainSelectors = [
        'main',
        'article',
        '.content',
        '.documentation',
        '.docs-content',
        '#main-content',
        '.main-content',
        '.markdown-body',
        '.api-content',
        '.api-documentation',
        '.reference-content',
        '[role="main"]',
        '[data-testid="api-content"]',
        '#api-reference',
        '.content-wrap', // HubSpot specific
        '.content-body', // HubSpot specific
        '.api-endpoint-documentation', // HubSpot specific
      ];

      let mainContent = $();
      for (const selector of mainSelectors) {
        const found = $(selector);
        if (found.length > 0) {
          mainContent = found;
          break;
        }
      }

      // If no main content found, try the body
      if (mainContent.length === 0) {
        mainContent = $('body');
      }

      // Remove navigation, search, and other non-content elements
      mainContent.find('.navigation, .nav, .search, .sidebar, .footer, .header, .cookie-banner, .announcement, .toolbar, .api-tokens').remove();

      // Special handling for HubSpot API docs
      if (url.includes('app.hubspot.com/developer-docs')) {
        // Extract API endpoint information
        mainContent.find('[data-test-id="endpoint"], .endpoint-documentation').each((_, elem) => {
          const $endpoint = $(elem);
          
          // Get HTTP method and path
          const method = $endpoint.find('[data-test-id="method"], .http-method').text().trim();
          const path = $endpoint.find('[data-test-id="path"], .endpoint-path').text().trim();
          
          if (method && path) {
            content += `### ${method} ${path}\n\n`;
          }

          // Get description
          const description = $endpoint.find('[data-test-id="description"], .endpoint-description').text().trim();
          if (description) {
            content += `${description}\n\n`;
          }

          // Get parameters
          const $params = $endpoint.find('[data-test-id="parameters"], .parameters-section');
          if ($params.length > 0) {
            content += '#### Parameters\n\n';
            content += '| Name | Type | Required | Description |\n';
            content += '|------|------|----------|-------------|\n';
            
            $params.find('[data-test-id="parameter"], .parameter-row').each((_, param) => {
              const $param = $(param);
              const name = $param.find('[data-test-id="name"], .param-name').text().trim();
              const type = $param.find('[data-test-id="type"], .param-type').text().trim();
              const required = $param.find('[data-test-id="required"], .required-badge').length > 0 ? 'Yes' : 'No';
              const desc = $param.find('[data-test-id="description"], .param-description').text().trim();
              
              if (name) {
                content += `| ${name} | ${type || '-'} | ${required} | ${desc || '-'} |\n`;
              }
            });
            content += '\n';
          }

          // Get request/response examples
          $endpoint.find('[data-test-id="example"], .example-section').each((_, example) => {
            const $example = $(example);
            const title = $example.find('[data-test-id="title"], .example-title').text().trim();
            const code = $example.find('[data-test-id="code"], pre, code').text().trim();
            
            if (code) {
              content += `#### ${title || 'Example'}\n\n`;
              content += '```json\n' + code + '\n```\n\n';
            }
          });

          content += '---\n\n';
        });

        // If no endpoints found, try getting the overview content
        if (!content) {
          const overview = mainContent.find('[data-test-id="overview"], .api-overview').text().trim();
          if (overview) {
            content = overview + '\n\n';
          }
        }
      }

      // If no endpoints found, fall back to regular content processing
      if (!content) {
        // Process regular headings and text
        mainContent.find('h1, h2, h3, h4, h5, h6, p, ul, ol, table').each((_, elem) => {
          const $elem = $(elem);
          const text = $elem.text().trim();
          
          if (text) {
            if (elem.tagName.match(/^h[1-6]$/)) {
              const level = elem.tagName[1];
              content += `${'#'.repeat(parseInt(level))} ${text}\n\n`;
            } else if (elem.tagName === 'ul' || elem.tagName === 'ol') {
              $elem.find('li').each((_, li) => {
                content += `- ${$(li).text().trim()}\n`;
              });
              content += '\n';
            } else if (elem.tagName === 'table') {
              // Convert table to markdown
              const rows: string[][] = [];
              $elem.find('tr').each((_, tr) => {
                const row: string[] = [];
                $(tr).find('th, td').each((_, cell) => {
                  row.push($(cell).text().trim());
                });
                if (row.length > 0) {
                  rows.push(row);
                }
              });
              
              if (rows.length > 0) {
                content += '| ' + rows[0].join(' | ') + ' |\n';
                content += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n';
                rows.slice(1).forEach(row => {
                  content += '| ' + row.join(' | ') + ' |\n';
                });
                content += '\n';
              }
            } else {
              content += `${text}\n\n`;
            }
          }
        });
      }

      // Clean up content
      content = content
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+$/gm, '')
        .trim();

      if (!content) {
        throw new DocumentationError(
          'No content could be extracted from the page',
          'NO_CONTENT',
          url
        );
      }

      return {
        url,
        title: title.trim(),
        content,
        lastUpdated: $('meta[name="last-modified"]').attr('content') ||
                    $('meta[property="article:modified_time"]').attr('content') ||
                    $('time[datetime]').attr('datetime'),
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
          'Failed to generate documentation from any source. Please try a different product or check if the documentation is accessible.',
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
