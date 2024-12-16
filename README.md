# Latest Documentation Generator

[![CI](https://github.com/[username]/latest-documentation/actions/workflows/ci.yml/badge.svg)](https://github.com/[username]/latest-documentation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.0-black.svg)](https://nextjs.org/)

A modern, efficient Next.js application that generates up-to-date API documentation for software products in markdown format. Specifically designed for Large Language Models (LLMs) and agentic IDEs, this tool ensures your documentation stays current and accessible.

## 🌟 Features

- **Automated Documentation Generation**: Automatically generates latest API documentation from official sources
- **Multi-Product Support**: Handles documentation for multiple software products simultaneously
- **Markdown Output**: Generates clean, structured markdown files optimized for LLMs
- **Modern UI/UX**: Built with Shadcn UI components for a beautiful, responsive interface
- **Advanced Architecture**:
  - Next.js 14 App Router for optimal performance
  - Vercel AI integration for enhanced documentation processing
  - Rate limiting and security features built-in
  - Error handling and retry mechanisms
- **Developer Experience**:
  - TypeScript for type safety
  - ESLint and Prettier for code quality
  - GitHub Actions for CI/CD
  - Comprehensive documentation

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- Yarn or npm
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/[username]/latest-documentation.git
cd latest-documentation
```

2. Install dependencies:
```bash
yarn install
```

3. Create a `.env.local` file based on `.env.example`:
```bash
cp .env.example .env.local
```

4. Run the development server:
```bash
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 💻 Usage

1. **Start Documentation Generation**:
   - Enter the product name (e.g., HubSpot, Stripe)
   - Specify documentation requirements and preferences
   - Click "Generate Documentation"

2. **View Results**:
   - Generated markdown files are saved in `public/docs`
   - Each product gets its own documentation structure
   - Files are optimized for LLM consumption

3. **API Integration**:
   - Use the REST API endpoint at `/api/generate-docs`
   - Rate limiting applies to prevent abuse
   - Proper error handling included

## 🏗️ Architecture

### Tech Stack

- **Frontend**:
  - Next.js 14
  - React 18
  - Tailwind CSS
  - Shadcn UI
  - TypeScript

- **Backend**:
  - Next.js API Routes
  - Vercel AI SDK
  - Rate Limiting
  - Error Handling

- **Development**:
  - TypeScript
  - ESLint
  - Prettier
  - GitHub Actions

### Project Structure

```
latest-documentation/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API endpoints
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components/         # React components
│   └── utils/             # Utility functions
├── public/                # Static files
│   └── docs/             # Generated documentation
├── .github/              # GitHub configuration
├── next.config.js        # Next.js configuration
└── package.json          # Dependencies
```

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Visit [Vercel](https://vercel.com)
3. Import your repository
4. Configure environment variables:
   - `NEXT_PUBLIC_API_URL`
   - `RATE_LIMIT_MAX_REQUESTS`
   - `REQUEST_TIMEOUT_MS`
5. Click "Deploy"

### Configuration Files

- `vercel.json`: Deployment settings
- `next.config.js`: Next.js configuration
- `.env.example`: Environment variables template

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:
- Code of Conduct
- Development process
- How to submit pull requests
- Coding standards

## 🔒 Security

- Rate limiting on all API endpoints
- Input validation and sanitization
- Security headers configured
- Regular dependency updates
- Please report security vulnerabilities to [security@yourdomain.com]

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) team for the amazing framework
- [Vercel](https://vercel.com) for hosting and deployment
- [Shadcn UI](https://ui.shadcn.com/) for beautiful components
- All our contributors and users
