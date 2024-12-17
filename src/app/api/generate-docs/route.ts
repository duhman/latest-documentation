import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { DocumentationProcessor, DocumentationError } from '@/utils/documentationProcessor'

export interface GenerateDocsResponse {
  success: boolean
  message: string
  filePath?: string
  error?: {
    code: string
    message: string
    sourceUrl?: string
  }
}

export async function POST(req: Request) {
  try {
    const { product, requirements } = await req.json()

    // Input validation
    if (!product?.trim()) {
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

    // Create docs directory if it doesn't exist
    const docsDir = path.join(process.cwd(), 'public', 'docs')
    await mkdir(docsDir, { recursive: true })

    // Initialize the documentation processor
    const processor = new DocumentationProcessor(product, requirements)

    // Generate documentation
    const markdown = await processor.generateDocumentation()

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${product.toLowerCase()}-docs-${timestamp}.md`
    const filePath = path.join(docsDir, fileName)
    
    await writeFile(filePath, markdown, 'utf-8')

    // Convert absolute path to relative URL path
    const urlPath = `/docs/${fileName}`

    return NextResponse.json<GenerateDocsResponse>({
      success: true,
      message: 'Documentation generated successfully',
      filePath: urlPath,
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

    // Generic error response
    return NextResponse.json<GenerateDocsResponse>(
      {
        success: false,
        message: 'An unexpected error occurred',
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
