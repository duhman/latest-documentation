# Latest Documentation Generator

A powerful documentation generator that crawls and processes API documentation from various sources, with special support for HubSpot's API documentation.

## Features

- 🔍 Intelligent crawling with Firecrawl technology
- 📚 Specialized support for HubSpot API documentation
- 🎯 Extracts endpoints, parameters, examples, and descriptions
- 📝 Generates clean, well-formatted Markdown output
- 🔄 Handles dynamic, JavaScript-rendered content
- ⚡ Efficient parallel processing of multiple documentation pages

## Prerequisites

- Node.js 16.x or later
- npm 7.x or later

## Installation

1. Clone the repository:

```bash
git clone https://github.com/[username]/latest-documentation.git
cd latest-documentation
```

1. Install dependencies:

```bash
npm install
```

## Usage

1. Start the development server:

```bash
npm run dev
```

1. Access the documentation generator at `http://localhost:3000`

1. To generate documentation programmatically:

```typescript
import { DocumentationProcessor } from './utils/documentationProcessor';

const processor = new DocumentationProcessor();

// Generate documentation for a specific URL
const markdown = await processor.processDocumentation('https://app.hubspot.com/developer-docs/...');

// Or generate documentation for all configured sources
const fullDocs = await processor.generateDocumentation();
```

## Configuration

The documentation processor can be configured with various options:

```typescript
const options = {
  waitForSelectors: ['[data-test-id="endpoint"]'], // Elements to wait for
  waitForTimeout: 2000, // Timeout in milliseconds
  headers: {            // Custom headers for requests
    'User-Agent': '...',
    'Accept': '...'
  },
  extractors: {         // Content extraction rules
    endpoints: {
      selector: '...',
      multiple: true,
      extract: {
        // Nested extraction rules
      }
    }
  }
};
```

## Architecture

The project uses a modular architecture with the following key components:

- `DocumentationProcessor`: Main class for processing documentation
- `FirecrawlClient`: Handles browser automation and content extraction
- `MarkdownGenerator`: Converts extracted content to markdown format

## Error Handling

The system provides detailed error information through the `DocumentationError` class:

- `FETCH_ERROR`: Failed to fetch the documentation page
- `PARSE_ERROR`: Failed to parse the content
- `NO_CONTENT`: No content could be extracted
- `EXTRACTION_ERROR`: Failed to extract specific content
- `PROCESSING_ERROR`: General processing error

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
