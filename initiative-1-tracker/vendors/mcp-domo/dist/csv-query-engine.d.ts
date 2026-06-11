/**
 * CSV Query Engine
 * Executes SQL-like queries on CSV data stored locally
 *
 * IMPORTANT: This class is READ-ONLY. It only reads from the CSV file.
 * The CSV file is only updated by domo_refresh_data tool, never by queries.
 */
export interface QueryResult {
    columns: string[];
    rows: any[][];
}
export declare class CSVQueryEngine {
    private dataPath;
    private cache;
    constructor(dataPath?: string);
    /**
     * Get the path to the cached data file
     */
    getDataPath(): string;
    /**
     * Check if cached data exists
     */
    hasCachedData(): boolean;
    /**
     * Get the last modified time of cached data
     */
    getLastModified(): Date | null;
    /**
     * Load CSV data from file (lazy loading - only loads when needed)
     * READ-ONLY: Only reads from file, never writes
     */
    private loadData;
    /**
     * Execute a SQL-like query on the CSV data
     * Supports basic SELECT, WHERE, LIMIT, ORDER BY
     */
    executeQuery(sql: string): Promise<QueryResult>;
    /**
     * Evaluate a WHERE clause condition
     */
    private evaluateWhereClause;
    /**
     * Get basic stats about the cached data
     */
    getStats(): {
        rowCount: number;
        columnCount: number;
        lastModified: Date | null;
    };
}
//# sourceMappingURL=csv-query-engine.d.ts.map