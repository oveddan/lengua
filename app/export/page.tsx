'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Deck {
  id: string;
  name: string;
}

export default function ExportPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('all');
  const [format, setFormat] = useState<'basic' | 'cloze'>('cloze');
  const [includeContext, setIncludeContext] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/decks')
      .then((res) => res.json())
      .then((data) => {
        setDecks(data.decks);
        setLoading(false);
      });
  }, []);

  async function handleExport() {
    const params = new URLSearchParams();
    if (selectedDeck !== 'all') {
      params.set('deckId', selectedDeck);
    }
    params.set('format', format);
    params.set('includeContext', String(includeContext));

    const res = await fetch(`/api/export?${params}`);
    const data = await res.json();

    if (data.content) {
      // Create and download file
      const blob = new Blob([data.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Export to Anki</h1>
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select Deck</label>
            <select
              value={selectedDeck}
              onChange={(e) => setSelectedDeck(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Decks</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Card Format</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="cloze"
                  checked={format === 'cloze'}
                  onChange={(e) => setFormat(e.target.value as 'cloze')}
                  className="text-blue-600"
                />
                <span>Cloze (fill in the blank)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="basic"
                  checked={format === 'basic'}
                  onChange={(e) => setFormat(e.target.value as 'basic')}
                  className="text-blue-600"
                />
                <span>Basic (Spanish → English)</span>
              </label>
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="text-blue-600"
              />
              <span>Include context sentences</span>
            </label>
          </div>

          <button
            onClick={handleExport}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            Download Anki File
          </button>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            <strong>How to import:</strong>
            <ol className="list-decimal ml-4 mt-2 space-y-1">
              <li>Open Anki</li>
              <li>File → Import</li>
              <li>Select the downloaded .txt file</li>
              <li>Set &quot;Fields separated by: Tab&quot;</li>
              <li>For cloze cards, select &quot;Cloze&quot; note type</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
