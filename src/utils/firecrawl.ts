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
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      // Set headers
      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for selectors if specified
      if (options.waitForSelectors) {
        for (const selector of options.waitForSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: options.waitForTimeout || 5000 });
          } catch (error) {
            console.warn(`Warning: Selector "${selector}" not found`);
          }
        }
      }

      // Extract content using the provided extractors
      const result = await page.evaluate((extractors) => {
        function extract(config: ExtractorConfig, context: Element | Document = document): any {
          const elements = context.querySelectorAll(config.selector);
          
          if (elements.length === 0 && !config.optional) {
            return config.multiple ? [] : null;
          }

          if (config.extract) {
            const extractData = (element: Element) => {
              const data: Record<string, any> = {};
              for (const [key, subConfig] of Object.entries(config.extract!)) {
                if (typeof subConfig === 'string') {
                  const subElement = element.querySelector(subConfig);
                  data[key] = subElement ? subElement.textContent?.trim() : null;
                } else {
                  data[key] = extract(subConfig, element);
                }
              }
              return data;
            };

            if (config.multiple) {
              return Array.from(elements).map(extractData);
            } else {
              return extractData(elements[0]);
            }
          }

          if (config.transform) {
            if (config.multiple) {
              return Array.from(elements).map(el => config.transform!(el));
            } else {
              return config.transform!(elements[0]);
            }
          }

          if (config.multiple) {
            return Array.from(elements).map(el => el.textContent?.trim());
          }

          return elements[0].textContent?.trim();
        }

        const result: Record<string, any> = {};
        for (const [key, config] of Object.entries(extractors)) {
          result[key] = extract(config);
        }
        return result;
      }, options.extractors);

      return result;
    } finally {
      await browser.close();
    }
  }
}
