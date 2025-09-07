import { Router } from 'express';
import axios from "axios";
import dotenv from "dotenv";
import multer from 'multer';
import path from 'path';
import fs from 'fs';

    dotenv.config();
    // Configuração da API da Anthropic
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

    async function callAnthropicAPI(prompt) {
      try {
        const response = await axios.post(ANTHROPIC_API_URL, {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        });

        return response.data;
      } catch (error) {
        console.error('Erro na chamada da API Anthropic:', error.response?.data || error.message);
        throw error;
      }
    }

export default function workSpaceRouter({ openai, es }) {
  const router = Router();

  // PDF Text Extraction Function - Alternative implementation
  async function extractTextFromPDF(buffer) {
    try {
      console.log('🔍 Iniciando extração de texto do PDF...');

      // Use require instead of dynamic import to avoid initialization issues
      let pdfParse;
      try {
        // Use createRequire to handle module loading
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);

        // Load pdf-parse with error handling
        pdfParse = require('pdf-parse');
      } catch (importError) {
        console.error('❌ Erro ao carregar pdf-parse via require:', importError.message);

        // Fallback: try to use a simpler PDF extraction if available
        console.log('⚠️ Tentando método alternativo de extração...');
        try {
          // Use a basic text extraction from buffer
          const extractedText = buffer.toString('utf-8').substring(0, 1000); // Basic fallback
          if (extractedText && extractedText.length > 10) {
            console.log('✅ Extração básica realizada via buffer-to-string');
            return [{
              num_page: 1,
              text: cleanAndFormatPDFText(extractedText)
            }];
          }
        } catch (fallbackError) {
          console.error('❌ Falha também no método alternativo:', fallbackError.message);
        }

        throw new Error('Não foi possível carregar o módulo pdf-parse');
      }

      // Configure PDF parsing options for better text extraction
      const options = {
        pagerender: null,
        max: 0,
        version: 'v2.0.550'
      };

      const data = await pdfParse(buffer, options);
      let extractedText = data.text;

      console.log(`📄 Texto bruto extraído: ${extractedText.length} caracteres`);
      console.log('📄 Preview do texto bruto:', extractedText.substring(0, 500) + '...');

      // Clean and format the extracted text
      extractedText = cleanAndFormatPDFText(extractedText);

      console.log(`✅ Texto formatado: ${extractedText.length} caracteres`);
      console.log('✅ Preview do texto formatado:', extractedText.substring(0, 500) + '...');

      // Split into pages if needed for better processing
      const pages = splitTextIntoPages(extractedText);

      console.log(`📑 Documento dividido em ${pages.length} páginas para processamento`);

      return pages;
    } catch (error) {
      console.error('❌ Erro na extração de texto do PDF:', error);

      // Return a fallback result instead of throwing
      console.log('⚠️ Retornando resultado fallback devido a erro de extração');
      return [{
        num_page: 1,
        text: 'Erro na extração do texto do PDF. O documento foi salvo mas o texto não pôde ser extraído.'
      }];
    }
  }

  // Clean and format PDF text
  function cleanAndFormatPDFText(text) {
    return text
      // Remove excessive whitespace and normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove multiple consecutive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Remove page headers/footers (common patterns)
      .replace(/^\s*\d+\s*$/gm, '') // Page numbers alone on lines
      .replace(/^\s*Página\s+\d+\s*$/gmi, '') // "Página X" patterns
      .replace(/^\s*Page\s+\d+\s*$/gmi, '') // "Page X" patterns
      .replace(/^\s*-\s*\d+\s*-\s*$/gm, '') // "- X -" patterns
      // Remove common header/footer patterns
      .replace(/^\s*MINISTÉRIO.*$/gmi, '')
      .replace(/^\s*PRESIDÊNCIA.*$/gmi, '')
      .replace(/^\s*REPÚBLICA.*$/gmi, '')
      .replace(/^\s*BRASIL.*$/gmi, '')
      .replace(/^\s*DIÁRIO.*OFICIAL.*$/gmi, '')
      // Clean up spacing
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      // Restore paragraph breaks
      .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2')
      // Clean up excessive whitespace again
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Split text into pages for better processing
  function splitTextIntoPages(text) {
    const pages = [];
    const lines = text.split('\n');
    let currentPage = '';
    let lineCount = 0;
    const maxLinesPerPage = 50; // Approximate lines per page

    for (const line of lines) {
      currentPage += line + '\n';
      lineCount++;

      if (lineCount >= maxLinesPerPage || line.trim() === '') {
        if (currentPage.trim()) {
          pages.push({
            num_page: pages.length + 1,
            text: currentPage.trim()
          });
        }
        currentPage = '';
        lineCount = 0;
      }
    }

    // Add remaining content
    if (currentPage.trim()) {
      pages.push({
        num_page: pages.length + 1,
        text: currentPage.trim()
      });
    }

    return pages;
  }

  // Configure multer for file uploads
  const storage = multer.memoryStorage(); // Store files in memory for processing
  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept only PDF files
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos PDF são permitidos'), false);
      }
    }
  });

  // Document management endpoints for workSpaceStore

  // GET /workspace/documents - Load all documents or specific parent children
  router.get('/documents', async (req, res) => {
    try {
      const { userId, parentId } = req.query; // Optional user filtering and parentId for children

      if (parentId) {
        // Return all child documents for the specified parentId
        let query = {
          index: 'workspace_documents',
          body: {
            query: {
              bool: {
                must: [
                  { term: { documentType: 'workspace_document' } },
                  { term: { parentId: parentId } }
                ]
              }
            },
            sort: [
              { pageNumber: { order: 'asc' } } // Sort pages by page number
            ],
            size: 1000
          }
        };

        // Add user filter if provided
        if (userId) {
          query.body.query.bool.must.push({ term: { userId: userId } });
        }

        const result = await es.search(query);

        const documents = result.hits.hits.map(hit => ({
          text: hit._source.content,
          num_page: hit._source.pageNumber
        }));

        res.json({
          success: true,
          documents: documents,
          total: result.hits.total.value
        });
      } else {
        // No parentId: return aggregated documents grouping by parentId
        let query = {
          index: 'workspace_documents',
          body: {
            query: {
              bool: {
                must: [
                  { term: { documentType: 'workspace_document' } }
                ]
              }
            },
            collapse: {
              field: 'parentId.keyword' // usa o campo exato, precisa ser keyword
            },
            sort: [
              { pageNumber: { order: 'asc' } } // Sort by pageNumber (first doc per parentId)
            ],
            size: 1000 // Increased to ensure we get all documents for aggregation
          }
        };

        // Add user filter if provided
        if (userId) {
          query.body.query.bool.must.push({ term: { userId: userId } });
        }

        const result = await es.search(query);

        // Process documents for aggregation
        const documents = [];
        const pdfGroups = new Map(); // parentId -> aggregated document

        for (const hit of result.hits.hits) {
          const doc = hit._source;
          doc.elasticId = hit._id;

          if (!doc.parentId) {
            // Standalone document (no parent)
            documents.push(doc);
          } else {
            // Child document - group by parentId
            if (!pdfGroups.has(doc.parentId)) {
              const originalTitle = doc.title.split(' - Página ')[0] || doc.title;
              pdfGroups.set(doc.parentId, {
                id: doc.parentId,
                elasticId: hit._id, // Use the first child's elasticId for ref
                type: 'pdf',
                title: originalTitle,
                content: doc.content, // Will be replaced with combined
                extractedContent: [], // Placeholder
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                userId: doc.userId,
                parentId: doc.parentId || null, // Root for aggregated
                aggregated: true, // Flag to distinguish aggregated documents
                metadata: { ...doc.metadata, totalPages: 1 }
              });
            }

            const group = pdfGroups.get(doc.parentId);

            // Add page content
            group.extractedContent.push({
              num_page: doc.pageNumber || group.extractedContent.length + 1,
              text: doc.content
            });

            group.metadata.totalPages = group.extractedContent.length;

            // Combine content
            if (group.content) {
              group.content += '\n\n' + doc.content;
            }

            // Update timestamps if earlier
            if (doc.createdAt < group.createdAt) group.createdAt = doc.createdAt;
          }
        }

        // Add aggregated PDFs
        for (const group of pdfGroups.values()) {
          // Sort pages by page number
          group.extractedContent.sort((a, b) => a.num_page - b.num_page);
          documents.push(group);
        }

        res.json({
          success: true,
          documents: documents,
          total: documents.length
        });
      }

    } catch (error) {
      console.error('Error loading documents:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao carregar documentos',
        error: error.message
      });
    }
  });

  // POST /workspace/documents - Save new document
  router.post('/documents', upload.single('file'), async (req, res) => {
    try {
      const { type, title, content, url, extractedContent, userId, parentId, metadata } = req.body;

      // Handle file upload for PDF documents
      let extractedPages = null;

      if (req.file) {
        // Extract text from PDF if it's a PDF file
        if (req.file.mimetype === 'application/pdf') {
          try {
            console.log('📄 Extraindo texto do PDF...');
            extractedPages = await extractTextFromPDF(req.file.buffer);
            console.log(`✅ Extração concluída: ${extractedPages.length} páginas processadas`);

            // Create individual documents for each extracted page
            if (extractedPages && extractedPages.length > 0) {
              const baseDocumentId = Date.now().toString();
              const now = new Date().toISOString();
              const indexedDocuments = [];

              for (let i = 0; i < extractedPages.length; i++) {
                const page = extractedPages[i];
                const pageDocumentId = `${baseDocumentId}_${i + 1}`;

                const pageDocument = {
                  id: pageDocumentId,
                  elasticId: '', // Will be set after indexing
                  type: type || 'pdf_page',
                  title: `${title} - Página ${page.num_page}`,
                  content: page.text,
                  url: url || null,
                  extractedContent: null, // Not needed since content is already the extracted text
                  fileData: null, // Don't save file data, only text
                  createdAt: now,
                  updatedAt: now,
                  userId: userId || 'anonymous',
                  parentId: parentId || baseDocumentId,
                  pageNumber: page.num_page,
                  totalPages: extractedPages.length,
                  metadata: {
                    ...metadata,
                    originalFileName: req.file.originalname,
                    pageNumber: page.num_page,
                    totalPages: extractedPages.length
                  },
                  documentType: 'workspace_document'
                };

                // Index page document in Elasticsearch
                const indexResult = await es.index({
                  index: 'workspace_documents',
                  body: pageDocument,
                  refresh: true
                });

                // Update with elastic ID
                pageDocument.elasticId = indexResult._id;

                // Update the document with elastic ID
                await es.update({
                  index: 'workspace_documents',
                  id: indexResult._id,
                  body: {
                    doc: { elasticId: indexResult._id }
                  },
                  refresh: true
                });

                indexedDocuments.push({
                  documentId: pageDocumentId,
                  elasticId: indexResult._id,
                  pageNumber: page.num_page
                });
              }

              console.log(`📄 ${extractedPages.length} páginas indexadas separadamente no Elasticsearch`);

              return res.json({
                success: true,
                message: `${extractedPages.length} páginas de documento salvas com sucesso`,
                documents: indexedDocuments,
                totalPages: extractedPages.length
              });
            }

          } catch (extractionError) {
            console.error('❌ Erro na extração de texto:', extractionError);
            return res.status(500).json({
              success: false,
              message: 'Erro ao extrair texto do PDF. Verifique se o arquivo é um PDF válido.',
              error: extractionError.message
            });
          }
        }
      }

      // Fallback: handle non-PDF documents or when no file is uploaded
      const documentId = Date.now().toString();
      const now = new Date().toISOString();

      const document = {
        id: documentId,
        elasticId: '', // Will be set after indexing
        type: type,
        title: title,
        content: content || null,
        url: url || null,
        extractedContent: extractedPages || extractedContent || null,
        fileData: null, // Don't save file data for single documents
        createdAt: now,
        updatedAt: now,
        userId: userId || 'anonymous',
        parentId: parentId || null,
        metadata: metadata || {},
        documentType: 'workspace_document'
      };

      // Index document in Elasticsearch
      const indexResult = await es.index({
        index: 'workspace_documents',
        body: document,
        refresh: true
      });

      // Update with elastic ID
      document.elasticId = indexResult._id;

      // Update the document with elastic ID
      await es.update({
        index: 'workspace_documents',
        id: indexResult._id,
        body: {
          doc: { elasticId: indexResult._id }
        },
        refresh: true
      });

      res.json({
        success: true,
        documentId: documentId,
        elasticId: indexResult._id,
        message: 'Documento salvo com sucesso'
      });

    } catch (error) {
      console.error('Error saving document:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao salvar documento',
        error: error.message
      });
    }
  });

  // PUT /workspace/documents/:id - Update document
  router.put('/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Add updated timestamp
      updateData.updatedAt = new Date().toISOString();

      // Update document in Elasticsearch
      const updateResult = await es.update({
        index: 'workspace_documents',
        id: id, // This should be the elastic ID
        body: {
          doc: updateData
        },
        refresh: true
      });

      res.json({
        success: true,
        message: 'Documento atualizado com sucesso',
        updatedFields: Object.keys(updateData)
      });

    } catch (error) {
      console.error('Error updating document:', error);

      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar documento',
        error: error.message
      });
    }
  });

  // DELETE /workspace/documents/:id - Delete document
  router.delete('/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Delete document from Elasticsearch
      await es.delete({
        index: 'workspace_documents',
        id: id, // This should be the elastic ID
        refresh: true
      });

      res.json({
        success: true,
        message: 'Documento excluído com sucesso'
      });

    } catch (error) {
      console.error('Error deleting document:', error);

      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao excluir documento',
        error: error.message
      });
    }
  });

  // GET /workspace/documents/:id - Get single document
  router.get('/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await es.get({
        index: 'workspace_documents',
        id: id
      });

      const document = {
        id: result._source.id,
        elasticId: result._id,
        type: result._source.type,
        title: result._source.title,
        content: result._source.content,
        url: result._source.url,
        extractedContent: result._source.extractedContent,
        createdAt: result._source.createdAt,
        updatedAt: result._source.updatedAt,
        userId: result._source.userId,
        parentId: result._source.parentId,
        metadata: result._source.metadata
      };

      res.json({
        success: true,
        document: document
      });

    } catch (error) {
      console.error('Error getting document:', error);

      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao buscar documento',
        error: error.message
      });
    }
  });

  return router;
}
