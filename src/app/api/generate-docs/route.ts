import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { readFileSync } from 'fs'
import path from 'path'
import { DocumentationProcessor, DocumentationError } from '@/utils/documentationProcessor'

interface GenerateDocsResponse {
  success: boolean
  message: string
  documentation?: string
  error?: {
    code: string
    message: string
    sourceUrl?: string
  }
}

export async function POST(request: Request) {
  try {
    const { productName, requirements } = await request.json()

    if (!productName?.trim()) {
      return NextResponse.json<GenerateDocsResponse>(
        {
          success: false,
          message: 'Validation failed',
          error: {
            code: 'INVALID_INPUT',
            message: 'Product name is required'
          }
        },
        { status: 400 }
      )
    }

    if (!requirements?.trim()) {
      return NextResponse.json<GenerateDocsResponse>(
        {
          success: false,
          message: 'Validation failed',
          error: {
            code: 'INVALID_INPUT',
            message: 'Documentation requirements are required'
          }
        },
        { status: 400 }
      )
    }

    const processor = new DocumentationProcessor()
    
    // Create docs directory if it doesn't exist
    const docsDir = path.join(process.cwd(), 'public', 'docs')
    await mkdir(docsDir, { recursive: true })

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${productName.toLowerCase()}-docs-${timestamp}.md`
    const filePath = path.join(docsDir, fileName)

    // Generate documentation
    const markdown = await processor.generateDocumentation(productName, requirements)
    
    await writeFile(filePath, markdown, 'utf-8')

    // Read the generated markdown file
    const documentation = readFileSync(filePath, 'utf-8')

    return NextResponse.json<GenerateDocsResponse>({
      success: true,
      message: 'Documentation generated successfully',
      documentation,
    })
  } catch (error) {
    console.error('Error generating documentation:', error)
    
    if (error instanceof DocumentationError) {
      const statusCode = {
        'INVALID_SOURCE': 404,
        'FETCH_ERROR': 502,
        'PARSE_ERROR': 500,
        'NO_CONTENT': 404,
      }[error.code] || 500;

      return NextResponse.json<GenerateDocsResponse>(
        {
          success: false,
          message: 'Documentation generation failed',
          error: {
            code: error.code,
            message: error.message,
            sourceUrl: error.sourceUrl
          }
        },
        { status: statusCode }
      )
    }

    return NextResponse.json<GenerateDocsResponse>(
      {
        success: false,
        message: 'Failed to generate documentation',
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      },
      { status: 500 }
    )
  }
}
