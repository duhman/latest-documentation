from firecrawl import FirecrawlApp
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from typing import List
import asyncio

class DocumentationScraper:
    def __init__(self):
        load_dotenv()
        api_key = os.getenv('FIRECRAWL_API_KEY')
        if not api_key:
            raise ValueError("FIRECRAWL_API_KEY not found in environment variables")
        self.firecrawl = FirecrawlApp(api_key)
        
    async def scrape_documentation(self, urls):
        try:
            print(f"Scraping {urls[0]}...")
            
            # Use Firecrawl to get the page content
            result = self.firecrawl.extract(
                urls,
                {
                    "prompt": "Extract Python documentation content including all classes, methods, and descriptions",
                    "schema": {
                        "title": "Python Documentation",
                        "description": "Documentation for a Python module",
                        "type": "object",
                        "required": ["module_name", "module_description", "sections"],
                        "properties": {
                            "module_name": {
                                "type": "string",
                                "description": "Name of the Python module"
                            },
                            "module_description": {
                                "type": "string",
                                "description": "Description of the module's purpose and functionality"
                            },
                            "sections": {
                                "type": "array",
                                "description": "List of documentation sections",
                                "items": {
                                    "type": "object",
                                    "required": ["title", "content"],
                                    "properties": {
                                        "title": {
                                            "type": "string",
                                            "description": "Title of the section"
                                        },
                                        "content": {
                                            "type": "string",
                                            "description": "Content of the section"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            )
            
            if not isinstance(result, dict) or not result.get('success'):
                raise Exception(f"Failed to fetch URL: {result}")
            
            # Format the content
            content = {
                'title': result['data'].get('module_name', ''),
                'content': [],
                'timestamp': datetime.now().isoformat(),
                'url': urls[0]
            }
            
            # Add module description
            if module_desc := result['data'].get('module_description'):
                content['content'].append({
                    'type': 'description',
                    'text': module_desc
                })
            
            # Add sections
            if sections := result['data'].get('sections', []):
                for section in sections:
                    if not isinstance(section, dict):
                        continue
                        
                    content['content'].append({
                        'type': 'section',
                        'title': section.get('title', ''),
                        'text': section.get('content', '')
                    })
            
            if not content['content']:
                print(f"Warning: No content found in {urls[0]}")
                
            print(f"Successfully scraped {urls[0]}")
            return content
            
        except Exception as e:
            print(f"Error scraping {urls[0]}: {str(e)}")
            return None
        
    def save_to_json(self, content, output_path):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
            print(f"Saved content to {output_path}")
            
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
