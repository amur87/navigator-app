import type { MatrixSession, MatrixSyncResponse } from './types';

export type MatrixRequestOptions = {
    method?: 'GET' | 'POST' | 'PUT';
    body?: Record<string, any> | null;
    query?: Record<string, string | number | boolean | undefined | null>;
    contentType?: string;
    rawBody?: BodyInit | null;
    timeoutMs?: number;
};

const buildUrl = (baseUrl: string, path: string, query?: MatrixRequestOptions['query']) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedBase = `${baseUrl.replace(/\/$/, '')}${normalizedPath}`;
    const queryString = Object.entries(query ?? {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');

    return queryString ? `${normalizedBase}?${queryString}` : normalizedBase;
};

export class MatrixHttpClient {
    private readonly session: MatrixSession;

    constructor(session: MatrixSession) {
        this.session = session;
    }

    async request<T = any>(path: string, options: MatrixRequestOptions = {}): Promise<T> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

        try {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${this.session.accessToken}`,
            };

            let body: BodyInit | undefined;
            if (options.rawBody) {
                body = options.rawBody;
                if (options.contentType) {
                    headers['Content-Type'] = options.contentType;
                }
            } else if (options.body) {
                headers['Content-Type'] = options.contentType ?? 'application/json';
                body = JSON.stringify(options.body);
            }

            const response = await fetch(buildUrl(this.session.homeserverUrl, path, options.query), {
                method: options.method ?? 'GET',
                headers,
                body,
                signal: controller.signal,
            });

            const text = await response.text();
            const data = text ? JSON.parse(text) : null;

            if (!response.ok) {
                const message = data?.error ?? `Matrix request failed with status ${response.status}`;
                const error = new Error(message) as Error & { status?: number; data?: any };
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data as T;
        } finally {
            clearTimeout(timeout);
        }
    }

    sync(since?: string, timeoutMs = 30000) {
        return this.request<MatrixSyncResponse>('/_matrix/client/v3/sync', {
            query: {
                since,
                timeout: timeoutMs,
            },
            timeoutMs: timeoutMs + 5000,
        });
    }
}

export default MatrixHttpClient;

