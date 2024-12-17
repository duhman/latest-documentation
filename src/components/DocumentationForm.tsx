'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import LoadingSpinner from './LoadingSpinner'

interface Source {
  title: string
  url: string
}

interface FormState {
  isLoading: boolean
  error: string | null
  success: boolean
  filePath?: string
}

export default function DocumentationForm() {
  const [product, setProduct] = useState('')
  const [requirements, setRequirements] = useState('')
  const [formState, setFormState] = useState<FormState>({
    isLoading: false,
    error: null,
    success: false
  })
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Reset form state
    setFormState({
      isLoading: true,
      error: null,
      success: false
    })

    try {
      // Validate input
      if (!product.trim() || !requirements.trim()) {
        throw new Error('Please fill in all fields')
      }

      const response = await fetch('/api/generate-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product: product.trim(),
          requirements: requirements.trim(),
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate documentation')
      }

      setFormState({
        isLoading: false,
        error: null,
        success: true,
        filePath: data.filePath
      })
    } catch (error) {
      console.error('Error:', error)
      setFormState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        success: false
      })
    }
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="product"
            className="block text-sm font-medium text-gray-700"
          >
            Product Name
          </label>
          <input
            type="text"
            id="product"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g., HubSpot"
            disabled={formState.isLoading}
            required
          />
        </div>

        <div>
          <label
            htmlFor="requirements"
            className="block text-sm font-medium text-gray-700"
          >
            Documentation Requirements
          </label>
          <textarea
            id="requirements"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Describe what specific documentation you need..."
            disabled={formState.isLoading}
            required
          />
        </div>

        <button
          type="submit"
          disabled={formState.isLoading}
          className="w-full inline-flex justify-center items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {formState.isLoading ? (
            <>
              <LoadingSpinner size="small" />
              <span className="ml-2">Generating Documentation...</span>
            </>
          ) : (
            'Generate Documentation'
          )}
        </button>
      </form>

      {/* Status Messages */}
      {formState.error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{formState.error}</div>
            </div>
          </div>
        </div>
      )}

      {formState.success && formState.filePath && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success!</h3>
              <div className="mt-2 text-sm text-green-700">
                Documentation has been generated successfully.{' '}
                <a
                  href={formState.filePath}
                  className="font-medium underline hover:text-green-900"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Documentation
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
