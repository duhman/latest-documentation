import asyncio
from documentation_scraper import DocumentationScraper
import os
import hashlib
from datetime import datetime

async def main():
    urls = [
        'https://docs.python.org/3/library/datetime.html'
    ]
    
    async with DocumentationScraper() as scraper:
        for url in [urls]:  # Wrap urls in a list as expected by scraper
            content = await scraper.scrape_documentation(url)
            if content:
                # Generate a unique filename based on URL and timestamp
                url_hash = hashlib.sha256(url[0].encode()).hexdigest()[:20]
                filename = f"doc_{url_hash}.json"
                output_path = os.path.join('data', 'docs', filename)
                
                # Save the content
                scraper.save_to_json(content, output_path)
                print(f"Successfully scraped and saved: {url[0]}")

if __name__ == '__main__':
    asyncio.run(main())
