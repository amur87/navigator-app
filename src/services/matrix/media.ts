import { Platform } from 'react-native';
import matrixConfig from '../../config/matrix';
import MatrixHttpClient from './http-client';

const inferMimeType = (fileName = '', fallback = 'application/octet-stream') => {
    const normalized = fileName.toLowerCase();
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    if (normalized.endsWith('.png')) {
        return 'image/png';
    }
    if (normalized.endsWith('.webp')) {
        return 'image/webp';
    }
    if (normalized.endsWith('.mp3')) {
        return 'audio/mpeg';
    }
    if (normalized.endsWith('.m4a')) {
        return 'audio/mp4';
    }
    if (normalized.endsWith('.aac')) {
        return 'audio/aac';
    }
    if (normalized.endsWith('.pdf')) {
        return 'application/pdf';
    }

    return fallback;
};

export class MatrixMediaService {
    private readonly client: MatrixHttpClient;

    constructor(client: MatrixHttpClient) {
        this.client = client;
    }

    async uploadFile(asset: {
        uri: string;
        fileName?: string;
        type?: string;
        size?: number;
    }) {
        if (!asset.uri) {
            throw new Error('File URI is required for Matrix upload.');
        }

        if (asset.size && asset.size > matrixConfig.uploadMaxBytes) {
            throw new Error('Размер файла превышает допустимый лимит.');
        }

        const fileName = asset.fileName || `upload-${Date.now()}`;
        const mimeType = asset.type || inferMimeType(fileName);
        const formData = new FormData();
        formData.append('file', {
            uri: asset.uri,
            name: fileName,
            type: mimeType,
        } as any);

        const response = await this.client.request<{ content_uri: string }>(`/_matrix/media/v3/upload`, {
            method: 'POST',
            rawBody: formData,
            query: {
                filename: fileName,
            },
        });

        return {
            contentUri: response.content_uri,
            fileName,
            mimeType,
            size: asset.size,
        };
    }
}

export default MatrixMediaService;

