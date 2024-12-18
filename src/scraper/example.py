import asyncio
from documentation_scraper import DocumentationScraper
import os
from datetime import datetime

async def main():
    urls = [
        "https://platform.openai.com/docs/api-reference",
        "https://docs.python.org/3/library/datetime.html"
    ]
    
    async with DocumentationScraper() as scraper:
        for url in urls:
            content = await scraper.scrape_documentation([url])
            if content:
                # Generate unique filename
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"doc_{hash(url + timestamp)}.json"
                output_path = os.path.join("data", "docs", filename)
                scraper.save_to_json(content, output_path)
                print(f"Successfully scraped and saved: {url}")

if __name__ == "__main__":
    asyncio.run(main())
