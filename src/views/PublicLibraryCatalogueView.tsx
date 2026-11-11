import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  BookMarked,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Globe,
  Sparkles,
} from 'lucide-react';

export interface PublicBookRecord {
  id: number;
  accessionNumber: string;
  title: string;
  authors: string | null;
  editionYear: string | null;
  publisherPlace: string | null;
  isbn: string | null;
  pages: string | null;
  binding: string;
  status: 'AVAILABLE' | 'ISSUED' | 'LOST' | 'DAMAGED' | 'WITHDRAWN';
  totalCopies: number;
  availableCopies: number;
}

export const PublicLibraryCatalogueView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [books, setBooks] = useState<PublicBookRecord[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Categories
  useEffect(() => {
    fetch('/api/library/public/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      })
      .catch((err) => console.error('Failed to load public categories:', err));
  }, []);

  // Fetch Catalogue
  const fetchCatalogue = useCallback(
    async (qStr: string, catStr: string, pIndex: number) => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const offset = pIndex * limit;
        const params = new URLSearchParams({
          q: qStr,
          category: catStr,
          limit: String(limit),
          offset: String(offset),
        });

        const res = await fetch(`/api/library/public/catalogue?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setBooks(data.books || []);
          setTotalBooks(data.pagination?.total || 0);
        } else {
          setErrorMsg('Unable to retrieve catalogue records. Please try again later.');
        }
      } catch (err) {
        setErrorMsg('Network error while searching the catalogue.');
      } finally {
        setIsLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetchCatalogue(searchQuery, selectedCategory, page);
  }, [fetchCatalogue, searchQuery, selectedCategory, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchCatalogue(searchQuery, selectedCategory, 0);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setPage(0);
    fetchCatalogue('', '', 0);
  };

  const totalPages = Math.ceil(totalBooks / limit);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-stone-900 flex flex-col font-sans">
      {/* Header Banner */}
      <header className="bg-[#4B2E2E] text-white border-b-4 border-amber-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-100">
                Krishna Ayurvedic Medical College &amp; Hospital
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 font-medium">
                Central Library Public Book Catalogue &amp; Bibliographic Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white transition-colors"
            >
              ERP Staff &amp; Student Portal <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Search & Filter Bar */}
        <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-[#4B2E2E]" />
              <h2 className="text-base font-bold text-stone-900">Search Catalogue Collection</h2>
            </div>
            <span className="text-xs text-stone-500 font-mono">Read-Only Public Access</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Search Title, Author, ISBN, or Accession Number
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. Charaka Samhita, Sushruta, Chaukhambha, 978-..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-stone-50 focus:bg-white focus:ring-2 focus:ring-[#4B2E2E]"
                />
              </div>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Subject / Collection Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(0);
                }}
                className="w-full p-2 text-xs border rounded-xl bg-stone-50 focus:bg-white"
              >
                <option value="">All Categories &amp; Collections</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                className="w-full p-2 text-xs font-semibold bg-[#4B2E2E] hover:bg-[#3B2424] text-white rounded-xl shadow-xs transition-colors"
              >
                Search
              </button>
              {(searchQuery || selectedCategory) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-2 text-xs font-semibold text-stone-600 border rounded-xl hover:bg-stone-100"
                  title="Reset Search"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Results Info & Count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-stone-600 gap-2 px-1">
          <div>
            Showing <strong className="text-stone-900">{totalBooks === 0 ? 0 : page * limit + 1}</strong> to{' '}
            <strong className="text-stone-900">{Math.min((page + 1) * limit, totalBooks)}</strong> of{' '}
            <strong className="text-stone-900">{totalBooks}</strong> total bibliographic records
          </div>
          {isLoading && (
            <span className="flex items-center gap-1.5 text-stone-500">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#4B2E2E]" /> Querying database...
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Book Cards Grid */}
        {books.length === 0 && !isLoading ? (
          <div className="p-12 text-center bg-white border border-stone-200 rounded-2xl space-y-2">
            <BookOpen className="w-10 h-10 text-stone-300 mx-auto" />
            <h3 className="text-sm font-bold text-stone-800">No matching books found in catalogue</h3>
            <p className="text-xs text-stone-500">
              Try adjusting your search terms or selecting &quot;All Categories&quot; to browse full collection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {books.map((b) => {
              const isAvail = b.status === 'AVAILABLE';
              const availCopies = b.availableCopies;
              const totalCopies = b.totalCopies;

              return (
                <div
                  key={b.id}
                  className="p-5 bg-white border border-stone-200 hover:border-stone-400 rounded-2xl shadow-xs transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold text-stone-900 leading-snug line-clamp-2">
                        {b.title}
                      </h3>
                      <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded shrink-0">
                        {b.accessionNumber}
                      </span>
                    </div>

                    <div className="text-xs text-stone-600 space-y-0.5">
                      <p><strong className="text-stone-700">Author(s):</strong> {b.authors || 'Standard Authors / Samhita'}</p>
                      {b.publisherPlace && <p><strong className="text-stone-700">Publisher / Place:</strong> {b.publisherPlace}</p>}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-500 pt-1">
                        {b.editionYear && <span>Edition: {b.editionYear}</span>}
                        {b.isbn && <span className="font-mono">ISBN: {b.isbn}</span>}
                        {b.binding && <span className="bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded font-medium">{b.binding}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {isAvail ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {availCopies > 1 ? `${availCopies} of ${totalCopies} copies available` : 'Available in Central Library'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Currently Issued ({availCopies} available)
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-stone-400 font-mono">
                      Ref: KAMCH-{b.id}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-stone-200 text-xs">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-40 flex items-center gap-1 font-semibold"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <span className="text-stone-600 font-mono">
              Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
            </span>

            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-40 flex items-center gap-1 font-semibold"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* College Website Integration Snippet Drawer */}
        <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-2">
          <div className="font-bold text-[#4B2E2E] flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-700" />
            <span>College Website Integration Instructions</span>
          </div>
          <p className="text-stone-700">
            To place a link or button on the official Krishna Ayurvedic Medical College &amp; Hospital website leading to this catalogue:
          </p>
          <div className="p-3 bg-white border border-stone-300 rounded-xl font-mono text-[11px] text-stone-800 overflow-x-auto">
            <code>&lt;a href=&quot;/library-catalogue&quot; target=&quot;_blank&quot; class=&quot;btn-library-catalogue&quot;&gt;View Public Library Catalogue&lt;/a&gt;</code>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-6 border-t border-stone-800 text-xs text-center">
        <p>Krishna Ayurvedic Medical College and Hospital — Central Library Management System</p>
        <p className="text-stone-500 mt-1">Read-Only Public Catalogue Interface · Powered by KAMCH ERP</p>
      </footer>
    </div>
  );
};
