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
  isOwner: boolean;
}

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  muted: boolean;
  banned: boolean;
  isOwner: boolean;
  createdAt: string;
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

export interface FeedbackSubmission {
  id: string;
  issueNumber: number;
  issueUrl: string;
  title: string;
  createdAt: string;
  status: 'open' | 'done' | 'closed';
  closedAt: string | null;
}

export interface ItemUpsertBody {
  name?: string;
  description?: string;
  nutritionalFacts?: string;
  ingredients?: string;
  allergyInformation?: string;
  isSeasonal?: boolean;
  cost?: number | string;
  active?: boolean;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: createBaseQuery({ baseUrl: API_BASE, onUnauthorized: defaultOnUnauthorized }),
  tagTypes: ['Me', 'Item', 'Request', 'Review', 'Message', 'User', 'Feedback'],
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

    listItems: b.query<Item[], { includeInactive?: boolean } | void>({
      query: (params) => {
        const qs = params?.includeInactive ? '?include_inactive=1' : '';
        return { url: `items${qs}` };
      },
      transformResponse: (r: { data: Item[] }) => r.data,
      providesTags: ['Item'],
    }),
    getItem: b.query<Item, string>({
      query: (id) => ({ url: `items/${id}` }),
      transformResponse: (r: { data: Item }) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'Item', id }],
    }),
    createItem: b.mutation<Item, ItemUpsertBody>({
      query: (body) => ({ url: 'items', method: 'POST', body }),
      transformResponse: (r: { data: Item }) => r.data,
      invalidatesTags: ['Item'],
    }),
    updateItem: b.mutation<Item, { id: string; patch: ItemUpsertBody }>({
      query: ({ id, patch }) => ({ url: `items/${id}`, method: 'PATCH', body: patch }),
      transformResponse: (r: { data: Item }) => r.data,
      invalidatesTags: (_r, _e, a) => [{ type: 'Item', id: a.id }, 'Item'],
    }),
    deleteItem: b.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `items/${id}`, method: 'DELETE' }),
      transformResponse: (r: { data: { ok: boolean } }) => r.data,
      invalidatesTags: ['Item'],
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
    acceptRequest: b.mutation<OrderRequest, string>({
      query: (id) => ({ url: `requests/${id}/accept`, method: 'POST' }),
      transformResponse: (r: { data: OrderRequest }) => r.data,
      invalidatesTags: (_r, _e, id) => [{ type: 'Request', id }, 'Request'],
    }),
    completeRequest: b.mutation<OrderRequest, string>({
      query: (id) => ({ url: `requests/${id}/complete`, method: 'POST' }),
      transformResponse: (r: { data: OrderRequest }) => r.data,
      invalidatesTags: (_r, _e, id) => [{ type: 'Request', id }, 'Request'],
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

    listReviews: b.query<Review[], { includeUnapproved?: boolean } | void>({
      query: (params) => {
        const qs = params?.includeUnapproved ? '?include_unapproved=1' : '';
        return { url: `reviews${qs}` };
      },
      transformResponse: (r: { data: Review[] }) => r.data,
      providesTags: ['Review'],
    }),
    createReview: b.mutation<Review, { requestId: string; rating: number; comment: string }>({
      query: (body) => ({ url: 'reviews', method: 'POST', body }),
      transformResponse: (r: { data: Review }) => r.data,
      invalidatesTags: ['Review', 'Request'],
    }),
    approveReview: b.mutation<Review, string>({
      query: (id) => ({ url: `admin/reviews/${id}/approve`, method: 'POST' }),
      transformResponse: (r: { data: Review }) => r.data,
      invalidatesTags: ['Review'],
    }),
    deleteReview: b.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `admin/reviews/${id}`, method: 'DELETE' }),
      transformResponse: (r: { data: { ok: boolean } }) => r.data,
      invalidatesTags: ['Review'],
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

    getVapidPublicKey: b.query<string, void>({
      query: () => ({ url: 'push/vapid-public-key' }),
      transformResponse: (r: { data: { publicKey: string } }) => r.data.publicKey,
    }),
    subscribePush: b.mutation<
      { id: string; endpoint: string },
      { endpoint: string; p256dh: string; auth: string; userAgent?: string }
    >({
      query: (body) => ({ url: 'push/subscribe', method: 'POST', body }),
      transformResponse: (r: { data: { id: string; endpoint: string } }) => r.data,
    }),
    unsubscribePush: b.mutation<{ ok: boolean }, { endpoint?: string } | void>({
      query: (body) => ({
        url: 'push/subscribe',
        method: 'DELETE',
        ...(body && body.endpoint ? { body } : {}),
      }),
      transformResponse: (r: { data: { ok: boolean } }) => r.data,
    }),

    submitFeedback: b.mutation<
      { issueNumber: number; issueUrl: string },
      { body: string; pageUrl?: string }
    >({
      query: (body) => ({ url: 'feedback', method: 'POST', body }),
      transformResponse: (r: { data: { issueNumber: number; issueUrl: string } }) => r.data,
      invalidatesTags: ['Feedback'],
    }),
    listMyFeedback: b.query<FeedbackSubmission[], void>({
      query: () => ({ url: 'feedback/mine' }),
      transformResponse: (r: { data: FeedbackSubmission[] }) => r.data,
      providesTags: ['Feedback'],
    }),

    listAdminUsers: b.query<UserSummary[], void>({
      query: () => ({ url: 'admin/users' }),
      transformResponse: (r: { data: UserSummary[] }) => r.data,
      providesTags: ['User'],
    }),
    patchAdminUser: b.mutation<UserSummary, { id: string; isOwner?: boolean }>({
      query: ({ id, ...patch }) => ({ url: `admin/users/${id}`, method: 'PATCH', body: patch }),
      transformResponse: (r: { data: UserSummary }) => r.data,
      invalidatesTags: ['User'],
    }),
    banUser: b.mutation<UserSummary, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `admin/users/${id}/ban`,
        method: 'POST',
        ...(reason ? { body: { reason } } : {}),
      }),
      transformResponse: (r: { data: UserSummary }) => r.data,
      invalidatesTags: ['User'],
    }),
    unbanUser: b.mutation<UserSummary, string>({
      query: (id) => ({ url: `admin/users/${id}/unban`, method: 'POST' }),
      transformResponse: (r: { data: UserSummary }) => r.data,
      invalidatesTags: ['User'],
    }),
    muteUser: b.mutation<UserSummary, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `admin/users/${id}/mute`,
        method: 'POST',
        ...(reason ? { body: { reason } } : {}),
      }),
      transformResponse: (r: { data: UserSummary }) => r.data,
      invalidatesTags: ['User'],
    }),
    unmuteUser: b.mutation<UserSummary, string>({
      query: (id) => ({ url: `admin/users/${id}/unmute`, method: 'POST' }),
      transformResponse: (r: { data: UserSummary }) => r.data,
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useLogoutMutation,
  useListItemsQuery,
  useGetItemQuery,
  useCreateItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useListRequestsQuery,
  useGetRequestQuery,
  useCreateRequestMutation,
  useAcceptRequestMutation,
  useCompleteRequestMutation,
  useCancelRequestMutation,
  useListReviewsQuery,
  useCreateReviewMutation,
  useApproveReviewMutation,
  useDeleteReviewMutation,
  useListMessagesQuery,
  useSendMessageMutation,
  useMarkMessageReadMutation,
  useListAdminUsersQuery,
  usePatchAdminUserMutation,
  useBanUserMutation,
  useUnbanUserMutation,
  useMuteUserMutation,
  useUnmuteUserMutation,
  useSubmitFeedbackMutation,
  useListMyFeedbackQuery,
  useGetVapidPublicKeyQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
} = api;
