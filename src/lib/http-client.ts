import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { IHttpClient } from '../types/interfaces';
import { HttpResponse, RequestOptions, HttpClientOptions } from '../types';
// import { createLogger } from './logger';

// Simple logger fallback for now
const logger = {
  debug: (...args: unknown[]) => console.debug(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export class HttpClient implements IHttpClient {
  private client: AxiosInstance;
  private options: HttpClientOptions;

  constructor(options: HttpClientOptions) {
    this.options = options;

    const axiosConfig: AxiosRequestConfig = {
      timeout: 30000,
      headers: {
        'User-Agent': options.userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
    };

    if (options.proxy) {
      axiosConfig.proxy = {
        protocol: 'http',
        host: options.proxy.split(':')[0] || '',
        port: parseInt(options.proxy.split(':')[1] || '8080'),
      };
    }

    this.client = axios.create(axiosConfig);
  }

  async get(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.executeWithRetry('GET', url, undefined, options);
  }

  async post(
    url: string,
    data: unknown,
    options: RequestOptions = {}
  ): Promise<HttpResponse> {
    return this.executeWithRetry('POST', url, data, options);
  }

  private async executeWithRetry(
    method: 'GET' | 'POST',
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<HttpResponse> {
    const maxRetries = options.retries ?? this.options.maxRetries;
    let attempt = 0;
    let backoffMs = 1000;

    while (attempt <= maxRetries) {
      try {
        const config: AxiosRequestConfig = {
          method,
          url,
          data,
          timeout: options.timeout ?? 30000,
        };

        if (options.headers) {
          config.headers = options.headers;
        }

        logger.debug({ method, url, attempt }, 'Making HTTP request');

        const response: AxiosResponse = await this.client.request(config);

        logger.debug(
          {
            method,
            url,
            status: response.status,
            attempt,
          },
          'HTTP request successful'
        );

        return {
          data: response.data,
          status: response.status,
          headers: response.headers as Record<string, string>,
        };
      } catch (error) {
        attempt++;

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const isRetryable = !status || status >= 500 || status === 429;

          // Handle rate limiting
          if (status === 429) {
            const retryAfter = error.response?.headers['retry-after'];
            if (retryAfter) {
              backoffMs = parseInt(retryAfter as string) * 1000;
            }
          }

          logger.warn(
            {
              method,
              url,
              attempt,
              status,
              isRetryable,
              error: error.message,
            },
            'HTTP request failed'
          );

          if (!isRetryable || attempt > maxRetries) {
            throw new Error(`HTTP ${method} ${url} failed: ${error.message}`);
          }
        } else {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          logger.error(
            { method, url, attempt, error: errorMessage },
            'Non-HTTP error'
          );
          if (attempt > maxRetries) {
            throw error;
          }
        }

        if (attempt <= maxRetries) {
          logger.debug({ backoffMs, attempt }, 'Waiting before retry');
          await this.sleep(backoffMs);
          backoffMs = Math.min(
            backoffMs * this.options.backoffMultiplier,
            this.options.maxBackoffMs
          );
        }
      }
    }

    throw new Error(`HTTP ${method} ${url} failed after ${maxRetries} retries`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = require('timers');
      timer.setTimeout(resolve, ms);
    });
  }

  async checkRobotsTxt(baseUrl: string): Promise<boolean> {
    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      const response = await this.get(robotsUrl);

      if (response.status === 200) {
        const robotsTxt = response.data;
        const userAgentMatches =
          robotsTxt.includes('User-agent: *') ||
          robotsTxt.includes('User-agent: reddit-hire-notifier');

        if (userAgentMatches && robotsTxt.includes('Disallow: /')) {
          logger.warn({ baseUrl }, 'robots.txt disallows all crawling');
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.warn({ baseUrl, error }, 'Could not check robots.txt');
      return true; // Proceed if robots.txt is not accessible
    }
  }
}
