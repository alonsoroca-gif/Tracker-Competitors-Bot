/**
 * Multi-Dataset Query Engine
 * Supports querying individual datasets or cross-dataset queries
 */

import { CSVQueryEngine } from './csv-query-engine.js';
import { DatasetConfig, getAllDatasets, getDatasetById } from './dataset-config.js';
import { join } from 'path';
import { homedir } from 'os';

export interface QueryResult {
  columns: string[];
  rows: any[][];
  dataset?: string;
}

export class MultiDatasetEngine {
  private dataDir: string;
  private engines: Map<string, CSVQueryEngine> = new Map();

  constructor(dataDir?: string) {
    this.dataDir = dataDir || join(homedir(), '.domo-mcp');
  }

  /**
   * Get or create a query engine for a specific dataset
   */
  private getEngine(datasetId: string): CSVQueryEngine {
    if (!this.engines.has(datasetId)) {
      const dataset = getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Unknown dataset: ${datasetId}`);
      }
      const filePath = join(this.dataDir, dataset.filePath);
      this.engines.set(datasetId, new CSVQueryEngine(filePath));
    }
    return this.engines.get(datasetId)!;
  }

  /**
   * Execute a query on a specific dataset
   */
  async executeQuery(datasetId: string, sql: string): Promise<QueryResult> {
    const engine = this.getEngine(datasetId);
    const result = await engine.executeQuery(sql);
    return {
      ...result,
      dataset: datasetId,
    };
  }

  /**
   * Execute a cross-dataset query (simple union for now)
   * Future: Support JOINs, comparisons, etc.
   */
  async executeCrossDatasetQuery(sql: string, datasetIds?: string[]): Promise<QueryResult> {
    const datasets = datasetIds || getAllDatasets().map(d => d.id);
    
    // For now, execute query on each dataset and combine results
    // Future: Implement proper SQL parsing for cross-dataset queries
    const results = await Promise.all(
      datasets.map(async (datasetId) => {
        try {
          const result = await this.executeQuery(datasetId, sql);
          // Add dataset identifier to each row
          return {
            ...result,
            rows: result.rows.map(row => [datasetId, ...row]),
            columns: ['dataset', ...result.columns],
          };
        } catch (error: any) {
          // If dataset doesn't exist or has no data, skip it
          return null;
        }
      })
    );

    // Combine all results
    const validResults = results.filter(r => r !== null) as QueryResult[];
    if (validResults.length === 0) {
      return { columns: [], rows: [] };
    }

    // Use columns from first result (assuming they're the same)
    const columns = validResults[0].columns;
    const allRows = validResults.flatMap(r => r.rows);

    return {
      columns,
      rows: allRows,
    };
  }

  /**
   * Get stats for all datasets
   */
  getStats(): Array<{ dataset: string; rowCount: number; columnCount: number; lastModified: Date | null }> {
    return getAllDatasets().map(dataset => {
      try {
        const engine = this.getEngine(dataset.id);
        const stats = engine.getStats();
        return {
          dataset: dataset.id,
          ...stats,
        };
      } catch (error) {
        return {
          dataset: dataset.id,
          rowCount: 0,
          columnCount: 0,
          lastModified: null,
        };
      }
    });
  }

  /**
   * Check if a dataset has cached data
   */
  hasCachedData(datasetId: string): boolean {
    try {
      const engine = this.getEngine(datasetId);
      return engine.hasCachedData();
    } catch {
      return false;
    }
  }
}
