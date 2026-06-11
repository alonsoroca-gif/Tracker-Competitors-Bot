/**
 * Domo API Client
 * Handles OAuth authentication and dataset queries
 */
interface QueryResponse {
    columns: string[];
    rows: any[][];
}
export declare class DomoClient {
    private clientId;
    private clientSecret;
    private datasetId;
    private accessToken;
    private tokenExpiresAt;
    private baseUrl;
    getAccessToken(): string | null;
    constructor(clientId: string, clientSecret: string, datasetId: string);
    /**
     * Get OAuth access token using client credentials flow
     */
    private fetchAccessToken;
    /**
     * Ensure we have a valid access token
     */
    private ensureToken;
    /**
     * Get dataset data as CSV
     */
    getDatasetData(includeHeader?: boolean): Promise<string>;
    /**
     * Execute a SQL query on the dataset
     */
    executeQuery(sql: string): Promise<QueryResponse>;
    /**
     * Get dataset metadata/info
     */
    getDatasetInfo(): Promise<any>;
}
export {};
//# sourceMappingURL=domo-client.d.ts.map