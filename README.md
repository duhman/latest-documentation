# Latest Documentation Generator

A Next.js application that generates up-to-date API documentation for software products in markdown format, specifically designed for LLMs and agentic IDEs.

## Features

- Generate latest API documentation from official sources
- Support for multiple software products
- Markdown output format
- Modern UI with Shadcn UI components
- Built with Next.js App Router
- Vercel AI integration for enhanced documentation processing

## Getting Started

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Run the development server:
```bash
npm run dev
# or
yarn dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment on Vercel

This application is optimized for deployment on Vercel. To deploy:

1. Push your code to a GitHub repository

2. Visit [Vercel](https://vercel.com) and click "New Project"

3. Import your repository

4. Configure the following environment variables if needed:
   - `NEXT_PUBLIC_API_URL`: Your API URL (optional, defaults to same domain)

5. Click "Deploy"

The application will be automatically built and deployed to Vercel's global edge network.

### Deployment Configuration

The application includes several configuration files for optimal deployment:

- `vercel.json`: Configures deployment settings
- `next.config.js`: Configures Next.js settings
- `.gitignore`: Excludes unnecessary files
- `package.json`: Defines build and start scripts

## Usage

1. Enter the product name (e.g., HubSpot)
2. Specify your documentation requirements
3. Click "Generate Documentation"
4. The application will search, crawl, and generate markdown files with the latest documentation

## Tech Stack

- Next.js 14
- React 18
- Tailwind CSS
- Shadcn UI
- Vercel AI
- TypeScript
- Axios for HTTP requests
- Cheerio for web scraping

## Project Structure

```
latest-documentation/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── generate-docs/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── DocumentationForm.tsx
│   │   └── LoadingSpinner.tsx
│   └── utils/
│       ├── documentationProcessor.ts
│       └── markdownGenerator.ts
├── public/
│   └── docs/
├── next.config.js
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vercel.json
```

## License

MIT
