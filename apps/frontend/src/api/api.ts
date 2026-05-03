import { createApi } from '@reduxjs/toolkit/query/react';
import { createBaseQuery, defaultOnUnauthorized } from './base';

const API_BASE =
  typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost/api';

export type Role = 'member' | 'admin';
export type RequestStatus = 'pending' | 'accepted' | 'cancelled' | 'completed';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  muted: boolean;
  banned: boolean;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  nutritionalFacts: string;
  ingredients: string;
  allergyInformation: string;
  isSeasonal: boolean;
  cost: string;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItemLine {
  requestId: string;
  itemId: string;
  quantity: number;
  item?: Item;
}

export interface OrderRequest {
  id: string;
  userId: string;
  total: string;
  scheduledFor: string;
  contactName: string;
  contactEmail: string;
  contactNotes: string | null;
  status: RequestStatus;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: RequestItemLine[];
}

export interface Review {
  id: string;
  userId: string;
  requestId: string;
  rating: number;
  comment: string;
  approved: boolean;
  approvedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; displayName: string };
  request?: { id: string; scheduledFor: string };
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  sender?: { id: string; displayName: string };
  recipient?: { id: string; displayName: string };
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: createBaseQuery({ baseUrl: API_BASE, onUnauthorized: defaultOnUnauthorized }),
  tagTypes: ['Me', 'Item', 'Request', 'Review', 'Message'],
  endpoints: (b) => ({
    getMe: b.query<Me, void>({
      query: () => ({ url: 'auth/me' }),
      transformResponse: (r: { data: Me }) => r.data,
      providesTags: ['Me'],
    }),
    logout: b.mutation<{ ok: boolean; endSessionUrl: string | null }, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
      transformResponse: (r: { data: { ok: boolean; endSessionUrl: string | null } }) => r.data,
      invalidatesTags: ['Me'],
    }),

    listItems: b.query<Item[], void>({
      query: () => ({ url: 'items' }),
      transformResponse: (r: { data: Item[] }) => r.data,
      providesTags: ['Item'],
    }),
    getItem: b.query<Item, string>({
      query: (id) => ({ url: `items/${id}` }),
      transformResponse: (r: { data: Item }) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'Item', id }],
    }),

    listRequests: b.query<OrderRequest[], void>({
      query: () => ({ url: 'requests' }),
      transformResponse: (r: { data: OrderRequest[] }) => r.data,
      providesTags: ['Request'],
    }),
    getRequest: b.query<OrderRequest, string>({
      query: (id) => ({ url: `requests/${id}` }),
      transformResponse: (r: { data: OrderRequest }) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'Request', id }],
    }),
    createRequest: b.mutation<
      OrderRequest,
      {
        scheduledFor: string;
        contactName: string;
        contactEmail: string;
        contactNotes?: string | null;
        items: Array<{ itemId: string; quantity: number }>;
      }
    >({
      query: (body) => ({ url: 'requests', method: 'POST', body }),
      transformResponse: (r: { data: OrderRequest }) => r.data,
      invalidatesTags: ['Request'],
    }),
    cancelRequest: b.mutation<OrderRequest, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `requests/${id}/cancel`,
        method: 'POST',
        ...(reason ? { body: { reason } } : {}),
      }),
      transformResponse: (r: { data: OrderRequest }) => r.data,
      invalidatesTags: (_r, _e, a) => [{ type: 'Request', id: a.id }, 'Request'],
    }),

    listReviews: b.query<Review[], void>({
      query: () => ({ url: 'reviews' }),
      transformResponse: (r: { data: Review[] }) => r.data,
      providesTags: ['Review'],
    }),
    createReview: b.mutation<Review, { requestId: string; rating: number; comment: string }>({
      query: (body) => ({ url: 'reviews', method: 'POST', body }),
      transformResponse: (r: { data: Review }) => r.data,
      invalidatesTags: ['Review', 'Request'],
    }),

    listMessages: b.query<Message[], { box?: 'inbox' | 'sent' } | void>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params?.box) qs.set('box', params.box);
        const s = qs.toString();
        return { url: `messages${s ? `?${s}` : ''}` };
      },
      transformResponse: (r: { data: Message[] }) => r.data,
      providesTags: ['Message'],
    }),
    sendMessage: b.mutation<Message, { recipientId: string; content: string }>({
      query: (body) => ({ url: 'messages', method: 'POST', body }),
      transformResponse: (r: { data: Message }) => r.data,
      invalidatesTags: ['Message'],
    }),
    markMessageRead: b.mutation<Message, string>({
      query: (id) => ({ url: `messages/${id}/read`, method: 'POST' }),
      transformResponse: (r: { data: Message }) => r.data,
      invalidatesTags: ['Message'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useLogoutMutation,
  useListItemsQuery,
  useGetItemQuery,
  useListRequestsQuery,
  useGetRequestQuery,
  useCreateRequestMutation,
  useCancelRequestMutation,
  useListReviewsQuery,
  useCreateReviewMutation,
  useListMessagesQuery,
  useSendMessageMutation,
  useMarkMessageReadMutation,
} = api;
