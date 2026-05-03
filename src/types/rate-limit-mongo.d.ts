import type { Store, LegacyStore } from 'express-rate-limit';

declare module 'rate-limit-mongo' {
    interface RateLimitMongoOptions {
        uri: string;
        collectionName?: string;
        user?: string;
        password?: string;
        authSource?: string;
        collction?: object;
        connectionOptions?: object;
        expireTimeMs?: number;
        resetExpireDateOnChange?: boolean;
        errorHandler?: (error: any) => void;
        createTtlIndex?: boolean;
    }

    interface MongoStoreConstructor {
        new (options: RateLimitMongoOptions): Store;
    }

    const mongoStore: MongoStoreConstructor;
    export = mongoStore;
}

