'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import DocumentationForm from '@/components/DocumentationForm';

export default function Home() {
  const [productName, setProductName] = useState('');
  const [requirements, setRequirements] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setSuccess(false);
    setDocumentation('');

    try {
      const response = await fetch('/api/generate-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName,
          requirements,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setDocumentation(data.documentation || '');
      } else {
        console.error('Error:', data.error);
        setSuccess(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Latest Documentation Generator</h1>
      
      <div className="space-y-4 mb-8">
        <div>
          <label className="block mb-2">Product Name</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="e.g., hubspot"
          />
        </div>
        
        <div>
          <label className="block mb-2">Documentation Requirements</label>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            className="w-full p-2 border rounded h-32"
            placeholder="Enter specific requirements or search terms..."
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Generating Documentation...' : 'Generate Documentation'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-4 text-lg">Generating documentation...</span>
        </div>
      )}

      {!loading && success && !documentation && (
        <div className="flex items-center justify-center p-8">
          <div className="bg-green-500 rounded-full p-4">
            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}

      {documentation && (
        <div className="mt-8 p-6 border rounded-lg bg-white shadow-lg">
          <ReactMarkdown 
            className="prose max-w-none"
            components={{
              h1: ({node, ...props}) => <h1 className="text-3xl font-bold mb-4" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-2xl font-bold mt-8 mb-4" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-6 mb-3" {...props} />,
              h4: ({node, ...props}) => <h4 className="text-lg font-bold mt-4 mb-2" {...props} />,
              p: ({node, ...props}) => <p className="my-4" {...props} />,
              pre: ({node, ...props}) => <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto" {...props} />,
              code: ({node, className, children, ...props}: any) => 
                className?.includes('language-') ? 
                  <code className="block bg-gray-100 p-4 rounded-lg overflow-x-auto" {...props}>
                    {children}
                  </code> :
                  <code className="bg-gray-100 px-1 py-0.5 rounded" {...props}>
                    {children}
                  </code>,
              table: ({node, ...props}) => 
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200" {...props} />
                </div>,
              th: ({node, ...props}) => <th className="px-4 py-2 bg-gray-50 font-bold" {...props} />,
              td: ({node, ...props}) => <td className="px-4 py-2 border-t" {...props} />,
            }}
          >
            {documentation}
          </ReactMarkdown>
        </div>
      )}
    </main>
  );
}
