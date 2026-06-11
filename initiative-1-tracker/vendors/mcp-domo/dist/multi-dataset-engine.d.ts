/**
 * Multi-Dataset Query Engine
 * Supports querying individual datasets or cross-dataset queries
 */
export interface QueryResult {
    columns: string[];
    rows: any[][];
    dataset?: string;
}
export declare class MultiDatasetEngine {
    private dataDir;
    private engines;
    constructor(dataDir?: string);
    /**
     * Get or create a query engine for a specific dataset
     */
    private getEngine;
    /**
     * Execute a query on a specific dataset
     */
    executeQuery(datasetId: string, sql: string): Promise<QueryResult>;
    /**
     * Execute a cross-dataset query (simple union for now)
     * Future: Support JOINs, comparisons, etc.
     */
    executeCrossDatasetQuery(sql: string, datasetIds?: string[]): Promise<QueryResult>;
    /**
     * Get stats for all datasets
     */
    getStats(): Array<{
        dataset: string;
        rowCount: number;
        columnCount: number;
        lastModified: Date | null;
    }>;
    /**
     * Check if a dataset has cached data
     */
    hasCachedData(datasetId: string): boolean;
}
//# sourceMappingURL=multi-dataset-engine.d.ts.map