import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

export interface CreateBaseQueryOptions {
  baseUrl: string;
  onUnauthorized?: () => void;
  fetchFn?: typeof fetch;
}

export function createBaseQuery(
  options: CreateBaseQueryOptions,
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const rawQuery = fetchBaseQuery({
    baseUrl: options.baseUrl,
    credentials: 'include',
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
  });
  return async (args, api, extraOptions) => {
    const result = await rawQuery(args, api, extraOptions);
    if (result.error && result.error.status === 401) {
      options.onUnauthorized?.();
    }
    return result;
  };
}

export function defaultOnUnauthorized() {
  if (typeof window !== 'undefined') {
    window.location.assign('/api/auth/login');
  }
}
