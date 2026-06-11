/**
 * CSV Query Engine
 * Executes SQL-like queries on CSV data stored locally
 *
 * IMPORTANT: This class is READ-ONLY. It only reads from the CSV file.
 * The CSV file is only updated by domo_refresh_data tool, never by queries.
 */
import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
export class CSVQueryEngine {
    dataPath;
    cache = null;
    constructor(dataPath) {
        // Default to ~/.domo-mcp/data.csv
        this.dataPath = dataPath || join(homedir(), '.domo-mcp', 'data.csv');
    }
    /**
     * Get the path to the cached data file
     */
    getDataPath() {
        return this.dataPath;
    }
    /**
     * Check if cached data exists
     */
    hasCachedData() {
        return existsSync(this.dataPath);
    }
    /**
     * Get the last modified time of cached data
     */
    getLastModified() {
        if (!this.hasCachedData()) {
            return null;
        }
        const stats = statSync(this.dataPath);
        return stats.mtime;
    }
    /**
     * Load CSV data from file (lazy loading - only loads when needed)
     * READ-ONLY: Only reads from file, never writes
     */
    loadData() {
        if (this.cache && this.cache.lastModified === this.getLastModified()?.getTime()) {
            return { data: this.cache.data, columns: this.cache.columns };
        }
        if (!this.hasCachedData()) {
            throw new Error(`No cached data found at ${this.dataPath}. Please run domo_refresh_data first.`);
        }
        // Use streaming parser for large files to avoid memory issues
        const csvContent = readFileSync(this.dataPath, 'utf-8');
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            cast: false, // Don't cast to avoid memory overhead
            bom: true,
            relax_column_count: true,
        });
        // Convert to array of arrays format
        const columns = Object.keys(records[0] || []);
        const data = records.map((row) => columns.map((col) => row[col] ?? ''));
        // Cache the data
        this.cache = {
            data,
            columns,
            lastModified: this.getLastModified()?.getTime() || 0,
        };
        return { data, columns };
    }
    /**
     * Execute a SQL-like query on the CSV data
     * Supports basic SELECT, WHERE, LIMIT, ORDER BY
     */
    async executeQuery(sql) {
        const { data, columns } = this.loadData();
        // Simple SQL parser - handles basic SELECT queries
        const sqlUpper = sql.trim().toUpperCase();
        // Extract LIMIT
        const limitMatch = sqlUpper.match(/LIMIT\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1], 10) : null;
        // Extract WHERE clause
        const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
        const whereClause = whereMatch ? whereMatch[1].trim() : null;
        // Extract ORDER BY
        const orderByMatch = sql.match(/ORDER\s+BY\s+([^\s]+)(?:\s+(ASC|DESC))?(?:\s+LIMIT|$)/i);
        const orderByColumn = orderByMatch ? orderByMatch[1].replace(/['"]/g, '') : null;
        const orderByDirection = orderByMatch?.[2]?.toUpperCase() || 'ASC';
        // Extract SELECT columns
        const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
        let selectedColumns = columns;
        if (selectMatch) {
            const selectClause = selectMatch[1].trim();
            if (selectClause === '*') {
                selectedColumns = columns;
            }
            else {
                selectedColumns = selectClause
                    .split(',')
                    .map((col) => col.trim().replace(/['"]/g, ''));
            }
        }
        // Filter data based on WHERE clause
        let filteredData = data;
        if (whereClause) {
            filteredData = data.filter((row) => {
                return this.evaluateWhereClause(whereClause, row, columns);
            });
        }
        // Sort data based on ORDER BY
        if (orderByColumn) {
            const columnIndex = columns.indexOf(orderByColumn);
            if (columnIndex >= 0) {
                filteredData.sort((a, b) => {
                    const aVal = a[columnIndex];
                    const bVal = b[columnIndex];
                    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                    return orderByDirection === 'DESC' ? -comparison : comparison;
                });
            }
        }
        // Apply LIMIT
        if (limit !== null) {
            filteredData = filteredData.slice(0, limit);
        }
        // Select only requested columns
        const selectedColumnIndices = selectedColumns.map((col) => columns.indexOf(col));
        const resultData = filteredData.map((row) => selectedColumnIndices.map((idx) => (idx >= 0 ? row[idx] : null)));
        return {
            columns: selectedColumns,
            rows: resultData,
        };
    }
    /**
     * Evaluate a WHERE clause condition
     */
    evaluateWhereClause(whereClause, row, columns) {
        // Handle simple conditions: column = value, column LIKE value, column != value
        const operators = ['!=', '=', 'LIKE', '>', '<', '>=', '<='];
        for (const op of operators) {
            const regex = new RegExp(`(.+?)\\s*${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(.+)`, 'i');
            const match = whereClause.match(regex);
            if (match) {
                const left = match[1].trim().replace(/['"]/g, '');
                const right = match[2].trim().replace(/['"]/g, '');
                const columnIndex = columns.indexOf(left);
                if (columnIndex < 0)
                    continue;
                const cellValue = String(row[columnIndex] || '').toLowerCase();
                const compareValue = right.toLowerCase();
                switch (op) {
                    case '=':
                        return cellValue === compareValue;
                    case '!=':
                        return cellValue !== compareValue;
                    case 'LIKE':
                        return cellValue.includes(compareValue.replace(/%/g, ''));
                    case '>':
                        return Number(cellValue) > Number(compareValue);
                    case '<':
                        return Number(cellValue) < Number(compareValue);
                    case '>=':
                        return Number(cellValue) >= Number(compareValue);
                    case '<=':
                        return Number(cellValue) <= Number(compareValue);
                }
            }
        }
        // If no operator matched, try AND/OR logic
        if (whereClause.includes(' AND ')) {
            const parts = whereClause.split(' AND ');
            return parts.every((part) => this.evaluateWhereClause(part.trim(), row, columns));
        }
        if (whereClause.includes(' OR ')) {
            const parts = whereClause.split(' OR ');
            return parts.some((part) => this.evaluateWhereClause(part.trim(), row, columns));
        }
        return true;
    }
    /**
     * Get basic stats about the cached data
     */
    getStats() {
        if (!this.hasCachedData()) {
            return { rowCount: 0, columnCount: 0, lastModified: null };
        }
        const { data, columns } = this.loadData();
        return {
            rowCount: data.length,
            columnCount: columns.length,
            lastModified: this.getLastModified(),
        };
    }
}
//# sourceMappingURL=csv-query-engine.js.map