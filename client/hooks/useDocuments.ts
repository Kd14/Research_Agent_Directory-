import { useEffect, useState } from 'react';
import * as api from '../services/api';
import type { DocumentCategory, TechDocument } from '../types';

export function useDocuments() {
  const [documents, setDocuments] = useState<TechDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.fetchDocuments();
        if (data.documents) {
          setDocuments(data.documents);
          // Default select all initial documents
          setSelectedDocIds(data.documents.map((d: TechDocument) => d.id));
        }
      } catch (err) {
        console.error('Failed to fetch documents:', err);
      }
    })();
  }, []);

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const selectAllDocs = (select: boolean) => {
    setSelectedDocIds(select ? documents.map(d => d.id) : []);
  };

  const uploadDocument = async (file: File, category: DocumentCategory, title?: string, tags?: string) => {
    const data = await api.uploadDocument(file, category, title, tags);
    if (data.success && data.document) {
      setDocuments(prev => [data.document, ...prev]);
      setSelectedDocIds(prev => [...prev, data.document.id]);
    }
  };

  const createDocSnippet = async (title: string, category: DocumentCategory, content: string, tags?: string[]) => {
    const data = await api.createDocument(title, category, content, tags);
    if (data.success && data.document) {
      setDocuments(prev => [data.document, ...prev]);
      setSelectedDocIds(prev => [...prev, data.document.id]);
    }
  };

  const deleteDocument = async (docId: string) => {
    await api.deleteDocument(docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
    setSelectedDocIds(prev => prev.filter(id => id !== docId));
  };

  return {
    documents,
    selectedDocIds,
    setSelectedDocIds,
    toggleDocSelection,
    selectAllDocs,
    uploadDocument,
    createDocSnippet,
    deleteDocument
  };
}
