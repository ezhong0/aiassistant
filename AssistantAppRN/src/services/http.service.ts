import type { AppError } from '../types';

export interface HTTPConfig {
  baseURL: string;
  timeout: number;
  headers?: Record<string, string>;
}

export interface HTTPResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface HTTPError extends AppError {
  status?: number;
  response?: any;
}

export class HTTPService {
  private config: HTTPConfig;
  private authToken: string | null = null;

  constructor(config: HTTPConfig) {
    this.config = config;
  }

  /**
   * Set authentication token for requests
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  /**
   * Make HTTP request with proper error handling
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    customHeaders?: Record<string, string>
  ): Promise<HTTPResponse<T>> {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;
      const headers = this.buildHeaders(customHeaders);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(fullUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw this.createHTTPError(response);
      }

      const responseData = await response.json().catch(() => ({}));

      return {
        data: responseData,
        status: response.status,
        headers: this.parseHeaders(response.headers),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw this.createAppError('TIMEOUT', 'Request timeout');
        }
        throw this.createAppError('NETWORK_ERROR', error.message);
      }
      throw this.createAppError('UNKNOWN_ERROR', 'Unknown error occurred');
    }
  }

  /**
   * GET request
   */
  async get<T>(url: string, headers?: Record<string, string>): Promise<HTTPResponse<T>> {
    return this.request<T>('GET', url, undefined, headers);
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any, headers?: Record<string, string>): Promise<HTTPResponse<T>> {
    return this.request<T>('POST', url, data, headers);
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: any, headers?: Record<string, string>): Promise<HTTPResponse<T>> {
    return this.request<T>('PUT', url, data, headers);
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, headers?: Record<string, string>): Promise<HTTPResponse<T>> {
    return this.request<T>('DELETE', url, undefined, headers);
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: any, headers?: Record<string, string>): Promise<HTTPResponse<T>> {
    return this.request<T>('PATCH', url, data, headers);
  }

  /**
   * Build headers for request
   */
  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this.config.headers,
      ...customHeaders,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Parse response headers
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const parsed: Record<string, string> = {};
    headers.forEach((value, key) => {
      parsed[key] = value;
    });
    return parsed;
  }

  /**
   * Create HTTP error from response
   */
  private createHTTPError(response: Response): HTTPError {
    let errorMessage = `HTTP ${response.status}`;
    
    switch (response.status) {
      case 400:
        errorMessage = 'Bad Request';
        break;
      case 401:
        errorMessage = 'Unauthorized';
        break;
      case 403:
        errorMessage = 'Forbidden';
        break;
      case 404:
        errorMessage = 'Not Found';
        break;
      case 429:
        errorMessage = 'Rate Limit Exceeded';
        break;
      case 500:
        errorMessage = 'Internal Server Error';
        break;
      case 503:
        errorMessage = 'Service Unavailable';
        break;
    }

    return {
      code: this.getErrorCode(response.status),
      message: errorMessage,
      status: response.status,
      retryable: this.isRetryableStatus(response.status),
      details: { status: response.status, statusText: response.statusText },
    };
  }

  /**
   * Get error code from HTTP status
   */
  private getErrorCode(status: number): string {
    if (status >= 500) return 'SERVICE_UNAVAILABLE';
    if (status === 429) return 'RATE_LIMIT_EXCEEDED';
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status >= 400) return 'CLIENT_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Check if status is retryable
   */
  private isRetryableStatus(status: number): boolean {
    return status >= 500 || status === 429;
  }

  /**
   * Create app error
   */
  private createAppError(code: string, message: string): AppError {
    return {
      code,
      message,
      retryable: ['NETWORK_ERROR', 'TIMEOUT', 'SERVICE_UNAVAILABLE', 'RATE_LIMIT_EXCEEDED'].includes(code),
    };
  }
}

// Create default HTTP service instance
export const httpService = new HTTPService({
  baseURL: 'http://localhost:3000',
  timeout: 30000, // 30 seconds
});
