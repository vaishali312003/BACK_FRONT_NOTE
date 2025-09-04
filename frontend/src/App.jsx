import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Share2, Eye, Clock, Tag, Brain, Filter, BarChart3 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('keyword');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currentNote, setCurrentNote] = useState({
    title: '',
    content: '',
    is_public: false,
    tags: '',
    version: 1
  });

  // Fetch all notes
  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/notes?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
    setLoading(false);
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/search?days=7`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Enhanced search function
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          search_type: searchType,
          limit: 10,
          include_content: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
    setIsSearching(false);
  };

  // Save note (create or update)
  const saveNote = async () => {
    if (!currentNote.title.trim() || !currentNote.content.trim()) {
      alert('Please fill in both title and content');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (editingNote) {
        // Update existing note
        response = await fetch(`${API_BASE_URL}/notes/${editingNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentNote)
        });
      } else {
        // Create new note
        response = await fetch(`${API_BASE_URL}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: currentNote.title,
            content: currentNote.content,
            is_public: currentNote.is_public,
            tags: currentNote.tags
          })
        });
      }

      if (response.ok) {
        await fetchNotes();
        closeModal();
      } else if (response.status === 409) {
        alert('Note was modified by another user. Please refresh and try again.');
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
    setLoading(false);
  };

  // Delete note
  const deleteNote = async (id) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchNotes();
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  // Modal controls
  const openModal = (note = null) => {
    if (note) {
      setEditingNote(note);
      setCurrentNote({
        title: note.title,
        content: note.content,
        is_public: note.is_public,
        tags: note.tags,
        version: note.version
      });
    } else {
      setEditingNote(null);
      setCurrentNote({
        title: '',
        content: '',
        is_public: false,
        tags: '',
        version: 1
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
    setCurrentNote({
      title: '',
      content: '',
      is_public: false,
      tags: '',
      version: 1
    });
  };

  // Share note
  const shareNote = (noteId) => {
    const shareUrl = `${window.location.origin}/shared/${noteId}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard!');
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get search type color
  const getSearchTypeColor = (type) => {
    switch (type) {
      case 'semantic': return 'bg-purple-100 text-purple-800';
      case 'hybrid': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Smart Notes
              </h1>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                RAG Enabled
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </button>
              <button
                onClick={() => openModal()}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>New Note</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Search Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notes with AI-powered semantic search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="keyword">Keyword</option>
                <option value="semantic">Semantic</option>
                <option value="hybrid">Hybrid</option>
              </select>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>Search</span>
              </button>
            </div>
            
            {searchQuery && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Filter className="h-4 w-4" />
                <span>Search mode:</span>
                <span className={`px-2 py-1 rounded-full text-xs ${getSearchTypeColor(searchType)}`}>
                  {searchType.charAt(0).toUpperCase() + searchType.slice(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Analytics (Last 7 Days)</h3>
            {analytics ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{analytics.total_searches}</div>
                  <div className="text-sm text-gray-600">Total Searches</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{analytics.average_response_time}s</div>
                  <div className="text-sm text-gray-600">Avg Response Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{Object.keys(analytics.search_types).length}</div>
                  <div className="text-sm text-gray-600">Search Types Used</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{analytics.popular_queries.length}</div>
                  <div className="text-sm text-gray-600">Unique Queries</div>
                </div>
              </div>
            ) : (
              <button
                onClick={fetchAnalytics}
                className="text-indigo-600 hover:text-indigo-700"
              >
                Load Analytics
              </button>
            )}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Search Results ({searchResults.length})
            </h3>
            <div className="space-y-4">
              {searchResults.map((result) => (
                <div key={result.note.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{result.note.title}</h4>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        {(result.relevance_score * 100).toFixed(1)}% match
                      </span>
                      {result.note.is_public && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Public
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {result.note.content.substring(0, 150)}...
                  </p>
                  {result.matched_chunks.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 mb-1">Relevant excerpts:</div>
                      {result.matched_chunks.slice(0, 2).map((chunk, idx) => (
                        <div key={idx} className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded mb-1">
                          "{chunk.substring(0, 100)}..."
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Eye className="h-3 w-3" />
                        <span>{result.note.view_count} views</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(result.note.updated_at)}</span>
                      </span>
                      {result.note.tags && (
                        <span className="flex items-center space-x-1">
                          <Tag className="h-3 w-3" />
                          <span>{result.note.tags}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openModal(result.note)}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {result.note.is_public && (
                        <button
                          onClick={() => shareNote(result.note.id)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNote(result.note.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && !notes.length ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                </div>
              </div>
            ))
          ) : notes.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
              <p className="text-gray-500 mb-4">Create your first note to get started with AI-powered search</p>
              <button
                onClick={() => openModal()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Note
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900 line-clamp-1">{note.title}</h3>
                    <div className="flex items-center space-x-1">
                      {note.is_public && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Public
                        </span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        v{note.version}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {note.content}
                  </p>
                  
                  {note.tags && (
                    <div className="flex items-center space-x-1 mb-4">
                      <Tag className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{note.tags}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span className="flex items-center space-x-1">
                      <Eye className="h-3 w-3" />
                      <span>{note.view_count} views</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(note.updated_at)}</span>
                    </span>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => openModal(note)}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {note.is_public && (
                      <button
                        onClick={() => shareNote(note.id)}
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="Share"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Enhanced Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingNote ? 'Edit Note' : 'Create New Note'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={currentNote.title}
                    onChange={(e) => setCurrentNote({...currentNote, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter note title..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <input
                    type="text"
                    value={currentNote.tags}
                    onChange={(e) => setCurrentNote({...currentNote, tags: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter tags separated by commas..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    value={currentNote.content}
                    onChange={(e) => setCurrentNote({...currentNote, content: e.target.value})}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Write your note content here..."
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={currentNote.is_public}
                    onChange={(e) => setCurrentNote({...currentNote, is_public: e.target.checked})}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                    Make this note public (can be shared via link)
                  </label>
                </div>
                
                {editingNote && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex">
                      <div className="text-sm text-yellow-800">
                        <strong>Version:</strong> {currentNote.version} | 
                        <strong> Last updated:</strong> {formatDate(editingNote.updated_at)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNote}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : (editingNote ? 'Update Note' : 'Create Note')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;