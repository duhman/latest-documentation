import puppeteer from 'puppeteer';

interface ExtractorTransform {
  (element: Element): string;
}

interface ExtractorConfig {
  selector: string;
  multiple?: boolean;
  optional?: boolean;
  extract?: Record<string, ExtractorConfig | string>;
  transform?: ExtractorTransform;
}

interface CrawlOptions {
  waitForSelectors?: string[];
  waitForTimeout?: number;
  headers?: Record<string, string>;
  extractors: Record<string, ExtractorConfig>;
}

export class FirecrawlClient {
  async crawl(url: string, options: CrawlOptions): Promise<any> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      if (options.headers?.['User-Agent']) {
        await page.setUserAgent(options.headers['User-Agent']);
      }

      // Navigate to URL with longer timeout
      await page.goto(url, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: options.waitForTimeout || 30000
      });

      // Wait for content to be available
      try {
        await page.waitForFunction(
          () => {
            const content = document.querySelector('main, article, .documentation-content');
            return content && content.textContent && content.textContent.length > 100;
          },
          { timeout: options.waitForTimeout || 30000 }
        );
      } catch (error) {
        console.warn('Content loading timeout, continuing anyway');
      }

      // Extract content using page.evaluate
      const content = await page.evaluate(() => {
        // Helper function to clean text
        const cleanText = (text: string) => {
          return text
            .replace(/\s+/g, ' ')
            .replace(/\{\{.*?\}\}/g, '')
            .replace(/Copy code/g, '')
            .trim();
        };

        // Get all text content by walking through the DOM
        const extractContent = (element: Element): string => {
          // Skip script tags and navigation elements
          if (element.tagName === 'SCRIPT' || 
              element.tagName === 'STYLE' ||
              element.tagName === 'NAV' || 
              element.tagName === 'HEADER' || 
              element.tagName === 'FOOTER' ||
              (element instanceof HTMLElement && 
               (element.className.includes('cookie') ||
                element.className.includes('navigation') ||
                element.hidden))) {
            return '';
          }

          let content = '';

          // Check if this is an API endpoint
          const text = element.textContent || '';
          if (text.match(/^(GET|POST|PUT|PATCH|DELETE)\s+/)) {
            return `\n### ${cleanText(text)}\n\n`;
          }

          // Check if this is a code block
          if (element.tagName === 'PRE' || element.tagName === 'CODE') {
            const code = text.trim();
            if (code) {
              return `\n\`\`\`\n${code}\n\`\`\`\n\n`;
            }
            return '';
          }

          // Check for section headers
          if (element.tagName.match(/^H[1-6]$/)) {
            const level = element.tagName[1];
            return `\n${'#'.repeat(Number(level))} ${cleanText(text)}\n\n`;
          }

          // Process child nodes
          Array.from(element.children).forEach(child => {
            content += extractContent(child);
          });

          // Add text content if this is a leaf node with text
          if (element.children.length === 0 && text.trim()) {
            content += cleanText(text) + '\n\n';
          }

          return content;
        };

        // Look for main content container
        const mainContent = document.querySelector('main, article, .documentation-content');
        if (!mainContent) return { content: '' };

        // Clean up the DOM before extraction
        const clone = mainContent.cloneNode(true) as Element;
        Array.from(clone.querySelectorAll('script, style, nav, header, footer, [class*="cookie"], [class*="navigation"]'))
          .forEach(node => node.remove());

        return { content: extractContent(clone) };
      });

      return content;
    } finally {
      await browser.close();
    }
  }
}
