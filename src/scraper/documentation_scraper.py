from firecrawl import FirecrawlApp
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from typing import List

class DocumentationScraper:
    def __init__(self):
        load_dotenv()
        self.firecrawl = FirecrawlApp()
        
    async def scrape_documentation(self, url: List[str]):
        try:
            print(f"Scraping {url[0]}...")
            
            if 'platform.openai.com' in url[0]:
                # Handle OpenAI documentation structure
                result = await self.firecrawl.extract(
                    url,
                    {
                        "prompt": "Extract API documentation from the OpenAI API reference page",
                        "schema": {
                            "title": "OpenAI API Documentation",
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "headings": {"type": "array", "items": {"type": "string"}},
                                "endpoints": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "method": {"type": "string"},
                                            "path": {"type": "string"},
                                            "description": {"type": "string"}
                                        }
                                    }
                                },
                                "content": {"type": "array", "items": {"type": "string"}}
                            }
                        },
                        "selectors": {
                            "title": "//title/text()",
                            "headings": "//main//h1|//main//h2|//main//h3|//main//h4",
                            "endpoints": {
                                "selector": "//div[@data-testid='endpoint']",
                                "data": {
                                    "method": ".//span[@data-testid='method']/text()",
                                    "path": ".//span[@data-testid='path']/text()",
                                    "description": ".//div[@data-testid='description']//text()"
                                }
                            },
                            "content": {
                                "selector": "//main//p|//main//pre|//main//code|//main//ul|//main//ol",
                                "type": "text"
                            }
                        }
                    }
                )
                
                if not result.ok:
                    raise Exception(f"Failed to fetch URL: {result.status_code}")
                
                # Format the content
                content = {
                    'title': result.data[0].get('title', ''),
                    'content': [],
                    'timestamp': datetime.now().isoformat(),
                    'url': url[0]
                }
                
                # Add headings
                if result.data[0].get('headings'):
                    for heading in result.data[0]['headings']:
                        content['content'].append({
                            'type': 'heading',
                            'text': heading
                        })
                
                # Add content
                if result.data[0].get('content'):
                    for text in result.data[0]['content']:
                        content['content'].append({
                            'type': 'text',
                            'text': text
                        })
                
                # Add endpoints
                if result.data[0].get('endpoints'):
                    for endpoint in result.data[0]['endpoints']:
                        content['content'].append({
                            'type': 'endpoint',
                            'method': endpoint.get('method', ''),
                            'path': endpoint.get('path', ''),
                            'description': endpoint.get('description', '')
                        })
                
            else:
                # Handle Python documentation structure
                result = await self.firecrawl.extract(
                    url,
                    {
                        "prompt": "Extract documentation from the Python datetime library reference page",
                        "schema": {
                            "title": "Python Documentation",
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "heading": {"type": "string"},
                                "description": {"type": "string"},
                                "functions": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "signature": {"type": "string"},
                                            "description": {"type": "string"},
                                            "parameters": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "name": {"type": "string"},
                                                        "description": {"type": "string"}
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "selectors": {
                            "title": "//title/text()",
                            "heading": "//div[@class='document']//div[@class='section']//h1/text()",
                            "description": "//div[@class='document']//div[@class='section']//p/text()",
                            "functions": {
                                "selector": "//dl[@class='function']",
                                "data": {
                                    "signature": ".//dt/text()",
                                    "description": ".//dd//p/text()",
                                    "parameters": {
                                        "selector": ".//dd//dl[@class='field-list']//dt",
                                        "data": {
                                            "name": "./text()",
                                            "description": "../dd/text()"
                                        }
                                    }
                                }
                            }
                        }
                    }
                )
                
                if not result.ok:
                    raise Exception(f"Failed to fetch URL: {result.status_code}")
                
                # Format the content
                content = {
                    'title': result.data[0].get('title', ''),
                    'content': [],
                    'timestamp': datetime.now().isoformat(),
                    'url': url[0]
                }
                
                # Add heading
                if result.data[0].get('heading'):
                    content['content'].append({
                        'type': 'heading',
                        'text': result.data[0]['heading']
                    })
                
                # Add description
                if result.data[0].get('description'):
                    content['content'].append({
                        'type': 'description',
                        'text': result.data[0]['description']
                    })
                
                # Add functions
                if result.data[0].get('functions'):
                    for func in result.data[0]['functions']:
                        # Add function signature
                        if func.get('signature'):
                            content['content'].append({
                                'type': 'function_signature',
                                'text': func['signature']
                            })
                        
                        # Add function description
                        if func.get('description'):
                            content['content'].append({
                                'type': 'function_description',
                                'text': func['description']
                            })
                        
                        # Add parameters
                        if func.get('parameters'):
                            for param in func['parameters']:
                                content['content'].append({
                                    'type': 'parameter',
                                    'name': param.get('name', ''),
                                    'description': param.get('description', '')
                                })
            
            if not content['content']:
                print(f"Warning: No content found in {url[0]}")
                
            print(f"Successfully scraped {url[0]}")
            return content
            
        except Exception as e:
            print(f"Error scraping {url[0]}: {str(e)}")
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
