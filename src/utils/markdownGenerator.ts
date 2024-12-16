import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

interface MarkdownSection {
  title: string
  content: string
  sourceUrl?: string
  timestamp?: string
}

interface MarkdownMetadata {
  product: string
  generatedAt: string
  requirements?: string
  sources: string[]
}

export class MarkdownGenerator {
  private content: string = ''
  private metadata: MarkdownMetadata

  constructor(metadata: MarkdownMetadata) {
    this.metadata = metadata
  }

  private addMetadata() {
    this.content += '---\n'
    this.content += `product: ${this.metadata.product}\n`
    this.content += `generatedAt: ${this.metadata.generatedAt}\n`
    if (this.metadata.requirements) {
      this.content += `requirements: ${this.metadata.requirements}\n`
    }
    this.content += 'sources:\n'
    this.metadata.sources.forEach(source => {
      this.content += `  - ${source}\n`
    })
    this.content += '---\n\n'
  }

  private addTableOfContents(sections: MarkdownSection[]) {
    this.content += '## Table of Contents\n\n'
    sections.forEach((section, index) => {
      const anchor = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      this.content += `${index + 1}. [${section.title}](#${anchor})\n`
    })
    this.content += '\n---\n\n'
  }

  addSection(section: MarkdownSection) {
    const { title, content, sourceUrl, timestamp } = section
    
    this.content += `## ${title}\n\n`
    
    if (sourceUrl || timestamp) {
      this.content += '> '
      if (sourceUrl) {
        this.content += `Source: [${sourceUrl}](${sourceUrl})`
      }
      if (timestamp) {
        this.content += ` | Last Updated: ${timestamp}`
      }
      this.content += '\n\n'
    }
    
    this.content += `${content}\n\n`
    this.content += '---\n\n'
  }

  generateMarkdown(sections: MarkdownSection[]) {
    // Reset content
    this.content = ''
    
    // Add metadata
    this.addMetadata()
    
    // Add title
    this.content += `# ${this.metadata.product} Documentation\n\n`
    
    // Add requirements if present
    if (this.metadata.requirements) {
      this.content += `## Requirements\n\n${this.metadata.requirements}\n\n---\n\n`
    }
    
    // Add table of contents
    this.addTableOfContents(sections)
    
    // Add sections
    sections.forEach(section => this.addSection(section))
    
    return this.content
  }

  async saveToFile(outputDir: string): Promise<string> {
    // Create a filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sanitizedProduct = this.metadata.product.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const filename = `${sanitizedProduct}-docs-${timestamp}.md`
    
    // Ensure the output directory exists
    await mkdir(outputDir, { recursive: true })
    
    // Save the file
    const filepath = path.join(outputDir, filename)
    await writeFile(filepath, this.content, 'utf-8')
    
    return filepath
  }
}

export function formatCodeBlock(code: string, language: string = '') {
  return `\`\`\`${language}\n${code}\n\`\`\``
}

export function formatTable(headers: string[], rows: string[][]) {
  let table = ''
  
  // Add headers
  table += '| ' + headers.join(' | ') + ' |\n'
  
  // Add separator
  table += '| ' + headers.map(() => '---').join(' | ') + ' |\n'
  
  // Add rows
  rows.forEach(row => {
    table += '| ' + row.join(' | ') + ' |\n'
  })
  
  return table + '\n'
}

export function formatNote(text: string) {
  return `> **Note:** ${text}\n`
}

export function formatWarning(text: string) {
  return `> ⚠️ **Warning:** ${text}\n`
}
