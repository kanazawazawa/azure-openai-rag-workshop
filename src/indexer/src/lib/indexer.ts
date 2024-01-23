import { type BaseLogger } from 'pino';
import { AppConfig, unusedService } from '../plugins/config.js';
import { type AzureClients } from '../plugins/azure.js';
import { type OpenAiService } from '../plugins/openai.js';
import { FileInfos } from './file.js';
import { AzureAISearchVectorDB, QdrantVectorDB, VectorDB } from './vector-db/index.js';
import { EmbeddingModel } from './embedding-model.js';

export interface IndexFileOptions {
  throwErrors?: boolean;
}

export class Indexer {
  private vectorDB: VectorDB;
  private embeddingModel: EmbeddingModel;

  constructor(
    private logger: BaseLogger,
    config: AppConfig,
    azure: AzureClients,
    openai: OpenAiService,
    embeddingModelName: string = 'text-embedding-ada-002',
  ) {
    this.embeddingModel = new EmbeddingModel(logger, openai, embeddingModelName);

    if (config.azureSearchService !== unusedService) {
      this.vectorDB = new AzureAISearchVectorDB(logger, this.embeddingModel, azure);
    } else {
      this.vectorDB = new QdrantVectorDB(logger, this.embeddingModel, config);
    }
  }

  async createSearchIndex(indexName: string) {
    this.logger.debug(`Ensuring search index "${indexName}" exists`);
    this.vectorDB.ensureSearchIndex(indexName);
  }

  async deleteSearchIndex(indexName: string) {
    this.logger.debug(`Deleting search index "${indexName}"`);
    this.vectorDB.deleteSearchIndex(indexName);
  }

  async deleteFromIndex(indexName: string, filename?: string): Promise<void> {
    this.logger.debug(`Deleting file "${filename}" from search index "${indexName}"`);
    this.vectorDB.deleteFromIndex(indexName, filename);
  }

  async indexFile(indexName: string, fileInfos: FileInfos, options: IndexFileOptions = {}) {
    const { filename } = fileInfos;
    this.logger.debug(`Indexing file "${filename}" into search index "${indexName}..."`);

    try {
      await this.vectorDB.addToIndex(indexName, fileInfos);
    } catch (_error: unknown) {
      const error = _error as Error;
      if (options.throwErrors) {
        throw error;
      } else {
        this.logger.error(`Error indexing file "${filename}": ${error.message}`);
      }
    }
  }
}

