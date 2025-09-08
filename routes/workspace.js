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

  // PDF Text Extraction Function - Page by page implementation
  async function extractTextFromPDF(buffer) {
    try {
      console.log('🔍 Iniciando extração de texto do PDF página por página...');

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
        pagerender: null, // Use default page rendering
        max: 0,
        version: 'v2.0.550'
      };

      const data = await pdfParse(buffer, options);
      const numPages = data.numpages;
      const allText = data.text || '';

      console.log(`📄 PDF contém ${numPages} páginas reais`);
      console.log(`📄 Texto bruto total: ${allText.length} caracteres`);

      // Extract pages based on actual PDF structure
      const pages = [];

      if (numPages > 1) {
        // For multi-page PDFs, try to split by page markers or approximate division
        const cleanedText = cleanAndFormatPDFText(allText);

        // Look for common page separation patterns
        let textParts = cleanedText.split(/\n\s*(?:Página\s+\d+|Page\s+\d+|\f|\n\s*\d+\s*\n)\s*\n/gi);

        // If we don't find sufficient separators, divide by approximate character count per page
        if (textParts.length < numPages) {
          const avgCharsPerPage = Math.max(1000, cleanedText.length / numPages);
          textParts = [];

          for (let i = 1; i <= numPages; i++) {
            const start = (i - 1) * avgCharsPerPage;
            const end = Math.min(i * avgCharsPerPage, cleanedText.length);
            const pageText = cleanedText.substring(start, end);
            textParts.push(pageText);
          }
        }

        // Create pages from text parts
        for (let i = 0; i < Math.min(textParts.length, numPages); i++) {
          const pageText = textParts[i].trim();
          if (pageText) {
            pages.push({
              num_page: i + 1,
              text: pageText
            });
          }
        }
      } else {
        // For single page PDFs
        pages.push({
          num_page: 1,
          text: cleanAndFormatPDFText(allText)
        });
      }

      // Ensure we have pages for all actual PDF pages
      if (pages.length === 0 && numPages > 0) {
        console.log('⚠️ Nenhuma página processada, criando estrutura básica...');
        const cleanedText = cleanAndFormatPDFText(data.text || '');
        const avgCharsPerPage = Math.max(1000, cleanedText.length / numPages);

        for (let i = 1; i <= numPages; i++) {
          const start = (i - 1) * avgCharsPerPage;
          const end = i * avgCharsPerPage;
          const pageText = cleanedText.substring(start, end);

          pages.push({
            num_page: i,
            text: pageText.trim() || `Página ${i}`
          });
        }
      }

      console.log(`📑 PDF processado: ${numPages} páginas reais encontradas`);

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
                type: doc.type,
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

              // Create root PDF document entry
              const rootDocument = {
                id: baseDocumentId,
                elasticId: '', // Will be set after indexing
                type: 'pdf',
                title: title,
                content: null,
                url: url || null,
                extractedContent: null, // Will be populated with pages
                fileData: null, // Don't save file data for single documents
                createdAt: now,
                updatedAt: now,
                userId: userId || 'anonymous',
                parentId: null, // Root documents should have null parentId
                pageNumber: null,
                totalPages: extractedPages.length,
                metadata: {
                  ...metadata,
                  originalFileName: req.file.originalname,
                  totalPages: extractedPages.length
                },
                documentType: 'workspace_document'
              };

              // Index root document in Elasticsearch
              const rootIndexResult = await es.index({
                index: 'workspace_documents',
                body: rootDocument,
                refresh: true
              });

              // Update root document with elastic ID
              rootDocument.elasticId = rootIndexResult._id;
              await es.update({
                index: 'workspace_documents',
                id: rootIndexResult._id,
                body: {
                  doc: { elasticId: rootIndexResult._id }
                },
                refresh: true
              });

              // Add to indexed documents
              indexedDocuments.push({
                documentId: baseDocumentId,
                elasticId: rootIndexResult._id,
                parentId: rootDocument.parentId,
                pageNumber: null
              });

              // Create page documents
              for (let i = 0; i < extractedPages.length; i++) {
                const page = extractedPages[i];
                const pageDocumentId = `${baseDocumentId}_${i + 1}`;

                const pageDocument = {
                  id: pageDocumentId,
                  elasticId: '', // Will be set after indexing
                  type: 'pdf_page',
                  title: `${title} - Página ${page.num_page}`,
                  content: page.text,
                  url: url || null,
                  extractedContent: null,
                  fileData: null,
                  createdAt: now,
                  updatedAt: now,
                  userId: userId || 'anonymous',
                  parentId: baseDocumentId, // Points to root document
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
                const pageIndexResult = await es.index({
                  index: 'workspace_documents',
                  body: pageDocument,
                  refresh: true
                });

                // Update with elastic ID
                pageDocument.elasticId = pageIndexResult._id;
                await es.update({
                  index: 'workspace_documents',
                  id: pageIndexResult._id,
                  body: {
                    doc: { elasticId: pageIndexResult._id }
                  },
                  refresh: true
                });

                indexedDocuments.push({
                  documentId: pageDocumentId,
                  elasticId: pageIndexResult._id,
                  parentId: pageDocument.parentId,
                  pageNumber: page.num_page
                });
              }

              console.log(`📄 PDF root + ${extractedPages.length} páginas indexadas no Elasticsearch`);

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
        extractedContent: extractedPages || extractedContent || [{ num_page: 1, text: content || null }]  || null,
        fileData: null, // Don't save file data for single documents
        createdAt: now,
        updatedAt: now,
        userId: userId || 'anonymous',
        parentId: type == 'text' ? documentId : null, // Root documents should have null parentId
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
      const resp = await es.deleteByQuery({
        index: 'workspace_documents',
        body: {
          query: {
            term: {
              parentId: id  // Aqui você filtra pelo parentId
            }
          }
        },
        refresh: true // Garante que a exclusão será visível logo após
      });

      console.log('resp detele', resp);

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

  // Folder management endpoints for workSpaceStore

  // GET /workspace/folders - Load all folders or specific parent children
  router.get('/folders', async (req, res) => {
    try {
      const { userId, parentId } = req.query;

      let query = {
        index: 'workspace_folders',
        body: {
          query: {
            bool: {
              must: [
                { term: { documentType: 'workspace_folder' } }
              ]
            }
          },
          sort: [
            { createdAt: { order: 'asc' } }
          ],
          size: 1000
        }
      };

      // Add user filter if provided
      if (userId) {
        query.body.query.bool.must.push({ term: { userId: userId } });
      }

      const result = await es.search(query);

      const folders = result.hits.hits.map(hit => ({
        id: hit._source.id,
        elasticId: hit._id,
        type: hit._source.type,
        title: hit._source.title,
        parentId: hit._source.parentId,
        children: hit._source.children || [],
        createdAt: hit._source.createdAt,
        updatedAt: hit._source.updatedAt,
        userId: hit._source.userId,
        metadata: hit._source.metadata,
        documentType: hit._source.documentType
      }));

      res.json({
        success: true,
        folders: folders,
        total: result.hits.total.value
      });

    } catch (error) {
      console.error('Error loading folders:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao carregar pastas',
        error: error.message
      });
    }
  });

  // POST /workspace/folders - Save new folder
  router.post('/folders', async (req, res) => {
    try {
      const { type, title, parentId, userId, metadata } = req.body;

      const folderId = Date.now().toString();
      const now = new Date().toISOString();

      const folder = {
        id: folderId,
        elasticId: '', // Will be set after indexing
        type: type || 'folder',
        title: title,
        parentId: parentId || null,
        children: [],
        createdAt: now,
        updatedAt: now,
        userId: userId || 'anonymous',
        metadata: metadata || {},
        documentType: 'workspace_folder'
      };

      // Index folder in Elasticsearch
      const indexResult = await es.index({
        index: 'workspace_folders',
        body: folder,
        refresh: true
      });

      // Update with elastic ID
      folder.elasticId = indexResult._id;

      // Update the folder with elastic ID
      await es.update({
        index: 'workspace_folders',
        id: indexResult._id,
        body: {
          doc: { elasticId: indexResult._id }
        },
        refresh: true
      });

      res.json({
        success: true,
        folderId: folderId,
        elasticId: indexResult._id,
        message: 'Pasta criada com sucesso'
      });

    } catch (error) {
      console.error('Error saving folder:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar pasta',
        error: error.message
      });
    }
  });

  // PUT /workspace/folders/:id - Update folder
  router.put('/folders/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Add updated timestamp
      updateData.updatedAt = new Date().toISOString();

      // Update folder in Elasticsearch
      const updateResult = await es.update({
        index: 'workspace_folders',
        id: id, // This should be the elastic ID
        body: {
          doc: updateData
        },
        refresh: true
      });

      res.json({
        success: true,
        message: 'Pasta atualizada com sucesso',
        updatedFields: Object.keys(updateData)
      });

    } catch (error) {
      console.error('Error updating folder:', error);

      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: 'Pasta não encontrada'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar pasta',
        error: error.message
      });
    }
  });

  // DELETE /workspace/folders/:id - Delete folder (recursive - deletes subfolders and documents)
  router.delete('/folders/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Function to recursively collect all folders to delete
      const collectFoldersToDelete = async (folderId, foldersToDelete = []) => {
        // Add current folder
        foldersToDelete.push(folderId);

        try {
          // Find all child folders
          const childrenQuery = {
            index: 'workspace_folders',
            body: {
              query: {
                term: { parentId: folderId }
              }
            }
          };

          const childrenResult = await es.search(childrenQuery);
          const childrenFolders = childrenResult.hits.hits.map(hit => hit._id);

          // Recursively process children
          for (const childId of childrenFolders) {
            await collectFoldersToDelete(childId, foldersToDelete);
          }
        } catch (error) {
          console.error('Error finding child folders:', error);
        }

        return foldersToDelete;
      };

      // Get all folders to delete (recursive)
      const foldersToDelete = await collectFoldersToDelete(id);

      console.log(`🗂️ Deleting ${foldersToDelete.length} folders:`, foldersToDelete);

      // Delete all folders
      if (foldersToDelete.length > 0) {
        await es.deleteByQuery({
          index: 'workspace_folders',
          body: {
            query: {
              ids: {
                values: foldersToDelete
              }
            }
          },
          refresh: true
        });
      }

      // Also delete all documents that belong to these folders (including all subfolders)
      const folderIds = foldersToDelete;
      await es.deleteByQuery({
        index: 'workspace_documents',
        body: {
          query: {
            bool: {
              should: folderIds.map(folderId => ({ term: { parentId: folderId } }))
            }
          }
        },
        refresh: true
      });

      console.log(`📄 Deleting documents in ${folderIds.length} folders:`, folderIds);

      res.json({
        success: true,
        message: `${foldersToDelete.length} pastas e seus documentos excluídos com sucesso`,
        deletedFolders: foldersToDelete.length
      });

    } catch (error) {
      console.error('Error deleting folder:', error);

      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: 'Pasta não encontrada'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao excluir pasta',
        error: error.message
      });
    }
  });

  router.get('/verticalize/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await es.get({
            index: 'workspace_documents',
            id: id
        });

        const document = {
            elasticId: result._id,
            title: result._source.title,
            extractedContent: result._source.extractedContent,
            userId: result._source.userId,
            parentId: result._source.parentId,
        };

        console.log('📄 Documento encontrado:', {
            title: document.title,
            extractedContentLength: document.extractedContent?.length || 0
        });

        // Verifica se há conteúdo extraído
        if (!document.extractedContent || !Array.isArray(document.extractedContent)) {
            throw new Error('Documento não possui conteúdo extraído válido');
        }

        const textAnalyse = document.extractedContent
            .filter(page => page && page.text) // Filtra páginas válidas
            .map(page => page.text)
            .join(' ');

        console.log('📝 Texto analisado:', textAnalyse.substring(0, 200) + '...');

        if (!textAnalyse.trim()) {
            throw new Error('Conteúdo do documento está vazio');
        }

        const prompt = `
          Você é um especialista em análise de editais de concursos públicos. Analise o texto do edital fornecido e estruture o conteúdo programático em formato JSON seguindo exatamente a estrutura especificada.

          **TEXTO DO EDITAL:**
          ${textAnalyse}

          **INSTRUÇÕES DE ANÁLISE:**

          1. **Identificação Inteligente de Disciplinas:** 
            Procure por diferentes padrões de disciplinas, incluindo:
            - Títulos em MAIÚSCULAS (ex: DIREITO CONSTITUCIONAL, MATEMÁTICA, PORTUGUÊS)
            - Títulos com numeração (ex: "1. LÍNGUA PORTUGUESA", "DISCIPLINA 1 - INFORMÁTICA")
            - Títulos precedidos por palavras-chave (ex: "CONHECIMENTOS DE...", "NOÇÕES DE...")
            - Áreas de conhecimento (ex: "Conhecimentos Gerais", "Conhecimentos Específicos")
            - Disciplinas técnicas específicas do cargo
            - Matérias básicas (Português, Matemática, Raciocínio Lógico, Informática, etc.)
            - Disciplinas jurídicas (todos os ramos do Direito)
            - Disciplinas administrativas (Administração Pública, Gestão, etc.)
            - Disciplinas contábeis (Contabilidade Geral, Pública, Custos, etc.)
            - Outras áreas específicas mencionadas

          2. **Padrões de Estruturação Reconhecidos:**
            - Disciplinas podem estar separadas por linhas, numeração ou espaçamento
            - Cada disciplina pode ter seus tópicos numerados (1., 2., 3., etc.) ou com letras (a), b), c) ou com pont e virgula ou so ponto ou so virgula)
            - Subtópicos podem usar numeração decimal (1.1, 1.2) ou outros padrões
            - Conteúdo pode estar em parágrafos corridos ou listado

          3. **Estratégia de Identificação:**
            - Primeiro, identifique TODAS as possíveis disciplinas mencionadas no texto
            - Depois, associe o conteúdo que pertence a cada disciplina
            - Se encontrar conteúdo sem disciplina clara, crie uma disciplina "CONHECIMENTOS GERAIS" ou similar
            - Não ignore nenhuma área de conhecimento mencionada

          4. **Estruturação Hierárquica:**Para cada disciplina encontrada, organize em:
            - Tópicos (normalmente numerados como 1., 2., 3., etc.)
            - Subtópicos (quando existirem subdivisões)
            - Subsubtópicos (níveis mais profundos)
            - Itens (menor nível de detalhamento)

          5. **Identificação de Legislação:** Para cada item, identifique se é:
            - Lei (federal, estadual, complementar)
            - Decreto
            - Portaria
            - Instrução Normativa
            - Resolução
            - Súmula
            - Jurisprudência
            - Emenda Constitucional
            - Outros normativos

          6. **Extração de Detalhes Legislativos:**
            - Tipo da norma
            - Número
            - Data (quando disponível)
            - Âmbito (federal, estadual, municipal)
          
            **EXEMPLOS DE DISCIPLINAS QUE PODEM APARECER:**
            - LÍNGUA PORTUGUESA / PORTUGUÊS
            - MATEMÁTICA / RACIOCÍNIO LÓGICO-MATEMÁTICO
            - CONHECIMENTOS GERAIS / ATUALIDADES
            - INFORMÁTICA / NOÇÕES DE INFORMÁTICA
            - DIREITO CONSTITUCIONAL
            - DIREITO ADMINISTRATIVO
            - DIREITO CIVIL / DIREITO PROCESSUAL CIVIL
            - DIREITO PENAL / DIREITO PROCESSUAL PENAL
            - DIREITO TRIBUTÁRIO / DIREITO FINANCEIRO
            - CONTABILIDADE GERAL / CONTABILIDADE PÚBLICA
            - ADMINISTRAÇÃO PÚBLICA / ADMINISTRAÇÃO GERAL
            - ECONOMIA / FINANÇAS PÚBLICAS
            - ESTATÍSTICA
            - CONHECIMENTOS ESPECÍFICOS DO CARGO
            - LEGISLAÇÃO ESPECÍFICA
            - ÉTICA NO SERVIÇO PÚBLICO
            - E qualquer outra área mencionada no edital

          **ESTRUTURA JSON REQUERIDA:**

          {
            "originalDocumentId": "${document.elasticId}",
            "userId": "${document.userId}",
            "title": "${document.title}",
            "disciplines": [
              {
                "id": "uuid_gerado",
                "name": "nome_da_disciplina",
                "order": numero_ordem,
                "isCompleted": false,
                "completedAt": null,
                "progress": {
                  "total": total_itens,
                  "completed": 0,
                  "percentage": 0
                },
                "topics": [
                  {
                    "id": "uuid_gerado",
                    "number": "numero_topico",
                    "title": "titulo_topico",
                    "content": "conteudo_completo",
                    "order": numero_ordem,
                    "isCompleted": false,
                    "completedAt": null,
                    "isLegislation": true/false,
                    "legislationType": "lei|decreto|portaria|instrucao_normativa|resolucao|sumula|jurisprudencia|emenda_constitucional|null",
                    "legislationDetails": {
                      "type": "tipo_norma",
                      "number": "numero_norma",
                      "date": "data_norma",
                      "fullReference": "referencia_completa",
                      "scope": "federal|estadual|municipal"
                    },
                    "difficulty": null,
                    "estimatedHours": null,
                    "tags": ["tag1", "tag2"],
                    "notes": "",
                    "subtopics": [...]
                  }
                ]
              }
            ],
            "metadata": {
              "createdAt": "timestamp_atual",
              "updatedAt": "timestamp_atual",
              "version": "1.0",
              "totalItems": total_calculado,
              "completedItems": 0,
              "overallProgress": 0
            },
            "settings": {
              "autoProgressCalculation": true,
              "showLegislationIcons": true,
              "groupByDifficulty": false,
              "estimatedStudyTime": tempo_estimado_total
            }
          }

          **REGRAS IMPORTANTES:**

          2. Mantenha a numeração original dos tópicos quando disponível
          3. Se um item mencionar legislação específica, marque isLegislation como true
          5. Preserve o conteúdo original nos campos "content"
          6. Use arrays vazios quando não houver subtópicos
          7. Campos opcionais podem ser null se não identificados
          8. Tags devem incluir palavras-chave relevantes do conteúdo

          **EXEMPLO DE IDENTIFICAÇÃO DE LEGISLAÇÃO:**

          - "Lei federal nº 8.112/1990" → isLegislation: true, type: "lei", scope: "federal"
          - "Decreto estadual nº 123/2020" → isLegislation: true, type: "decreto", scope: "estadual"
          - "Súmula nº 473 do STF" → isLegislation: true, type: "sumula"
          - "Conceitos gerais" → isLegislation: false

          **ATENÇÃO ESPECIAL:**
          - Se o edital menciona "Conhecimentos Gerais E Específicos", trate como disciplinas separadas
          - Se há uma seção de "Conhecimentos Básicos", inclua todas as matérias dessa seção
          - Não assuma que só existem disciplinas jurídicas - editais podem ter matemática, português, informática, etc.
          - Se encontrar listas de conteúdo sem título claro de disciplina, agrupe em "CONHECIMENTOS COMPLEMENTARES"

          **REGRAS CRÍTICAS:**
          1. **CAPTURE TODAS AS DISCIPLINAS:** Não limite apenas ao Direito - inclua TODAS as áreas mencionadas
          2. **SEJA ABRANGENTE:** Se há dúvida se algo é uma disciplina, inclua
          3. **MANTENHA HIERARQUIA:** Preserve a estrutura original do edital
          4. **GERE IDs ÚNICOS:** Use timestamps ou UUIDs para cada elemento
          5. **CALCULE TOTAIS:** Some todos os itens para o campo "total"
          6. **PRESERVE CONTEÚDO:** Mantenha o texto original nos campos "content"
          7. **IDENTIFIQUE LEGISLAÇÃO:** Marque corretamente leis, decretos, etc.


          Responda APENAS com o JSON estruturado, sem texto adicional.
        `;

        console.log('🤖 Chamando Anthropic API...');
        const anthropicResponse = await callAnthropicAPI(prompt);
        console.log('✅ Resposta da Anthropic recebida');

        // Extrai o texto da resposta da Anthropic (formato correto)
        let responseText;
        if (anthropicResponse && anthropicResponse.content && anthropicResponse.content.length > 0) {
            // Extrai apenas o texto da primeira resposta (conteúdo principal)
            responseText = anthropicResponse.content[0].text;
        } else {
            throw new Error('Formato de resposta da Anthropic inválido');
        }

        console.log('🔧 Texto da resposta:', responseText.substring(0, 100) + '...');

        // Parse da resposta JSON
        let structuredData;
        try {
            structuredData = JSON.parse(responseText);
            console.log('✅ JSON parseado com sucesso');
        } catch (parseError) {
            console.error('❌ Erro ao parsear JSON da resposta:', parseError.message);
            console.error('Resposta que falhou:', responseText);

            // Tenta limpar a resposta removendo caracteres não-JSON
            const cleanedResponse = responseText
                .replace(/^[^{]*/, '') // Remove tudo antes da primeira {
                .replace(/[^}]*$/, ''); // Remove tudo depois da última }

            try {
                structuredData = JSON.parse(cleanedResponse);
                console.log('✅ JSON parseado após limpeza');
            } catch (secondParseError) {
                throw new Error('Erro ao parsear resposta da IA mesmo após limpeza: ' + secondParseError.message);
            }
        }

        // Verifica se o JSON tem a estrutura esperada
        if (!structuredData || !structuredData.disciplines) {
            throw new Error('Estrutura JSON inválida retornada pela IA');
        }

        console.log(`📊 Estrutura extraída: ${structuredData.disciplines.length} disciplinas`);

        // Salva no Elasticsearch com índice específico para conteúdo verticalizado
        console.log('💾 Indexando dados no Elasticsearch...');
        const indexResponse = await es.index({
            index: 'edital_verticalizer',
            body: structuredData
        });

        console.log('✅ Conteúdo verticalizado indexado com sucesso');

        res.json({
            success: true,
            message: 'Conteúdo verticalizado com sucesso',
            data: {
                originalDocumentId: document.elasticId,
                verticalizedId: indexResponse._id, // Corrigido: é indexResponse._id, não indexResponse.body._id
                disciplinesCount: structuredData.disciplines.length,
                totalItems: structuredData.metadata ? structuredData.metadata.totalItems : 0
            }
        });

    } catch (error) {
        console.error('Erro na verticalização:', error);

        // Adiciona mais informações de debug no erro
        let errorMessage = 'Erro ao verticalizar conteúdo';
        if (error.message) {
            errorMessage += ': ' + error.message;
        }

        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message,
            stack: error.stack
        });
    }
});

  return router;
}
