/**
 * Domo API Client
 * Handles OAuth authentication and dataset queries
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface QueryRequest {
  sql: string;
}

interface QueryResponse {
  columns: string[];
  rows: any[][];
}

export class DomoClient {
  private clientId: string;
  private clientSecret: string;
  private datasetId: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private baseUrl = 'https://api.domo.com';

  // Expose accessToken for streaming operations
  getAccessToken(): string | null {
    return this.accessToken;
  }

  constructor(clientId: string, clientSecret: string, datasetId: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.datasetId = datasetId;
  }

  /**
   * Get OAuth access token using client credentials flow
   */
  private async fetchAccessToken(): Promise<string> {
    const tokenUrl = `${this.baseUrl}/oauth/token`;
    
    // Create Basic Auth header
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const data = await response.json() as TokenResponse;
    this.accessToken = data.access_token;
    // Set expiration with 60 second buffer
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    
    return this.accessToken;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureToken(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.fetchAccessToken();
    }
    return this.accessToken!;
  }

  /**
   * Get dataset data as CSV
   */
  async getDatasetData(includeHeader: boolean = true): Promise<string> {
    await this.ensureToken();
    
    const url = `${this.baseUrl}/v1/datasets/${this.datasetId}/data?includeHeader=${includeHeader}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'text/csv',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get dataset data: ${response.status} ${errorText}`);
    }

    // For very large files, read as stream and convert to string
    // This handles files larger than Node's string limit
    const reader = response.body?.getReader();
    if (!reader) {
      return await response.text();
    }

    const decoder = new TextDecoder();
    let result = '';
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        result += decoder.decode(value, { stream: true });
      }
    }

    return result;
  }

  /**
   * Execute a SQL query on the dataset
   */
  async executeQuery(sql: string): Promise<QueryResponse> {
    await this.ensureToken();
    
    const url = `${this.baseUrl}/v1/datasets/query/execute/${this.datasetId}`;
    
    const requestBody: QueryRequest = { sql };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to execute query: ${response.status} ${errorText}`);
    }

    return await response.json() as QueryResponse;
  }

  /**
   * Get dataset metadata/info
   */
  async getDatasetInfo(): Promise<any> {
    await this.ensureToken();
    
    const url = `${this.baseUrl}/v1/datasets/${this.datasetId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get dataset info: ${response.status} ${errorText}`);
    }

    return await response.json() as QueryResponse;
  }
}
