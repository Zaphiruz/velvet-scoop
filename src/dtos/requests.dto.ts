// Request DTOs and types

export interface CreateOrderRequest {
  items: [{
    itemId: string;
    quantity: number;
  }];
  date: Date;
  contact: {
    name: string;
    email: string;
    notes?: string;
  };
}

export interface OrderResponse {
  _id: string;
  user: string;
  items: [{
    itemId: string;
    quantity: number;
  }];
  total: number;
  date: Date;
  contact: {
    name: string;
    email: string;
    notes?: string;
  };
  accepted: boolean;
  acceptedBy?: string;
  acceptedAt?: Date;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
  cancelled: boolean;
  cancelledBy?: string;
  cancelledAt?: Date;
  deleted: boolean;
  deletedBy?: string;
  deletedAt?: Date;
  status: string;
  createdAt: Date;
}

export function toOrderResponse(order: any): OrderResponse {
  return {
    _id: order._id,
    user: order.user?.toString(),
    items: order.items.map((i: any) => ({
      itemId: i.itemId?.toString(),
      quantity: i.quantity,
    })),
    total: order.total,
    date: order.date,
    contact: {
      name: order.contact?.name,
      email: order.contact?.email,
      notes: order.contact?.notes,
    },
    accepted: order.accepted,
    acceptedBy: order.acceptedBy?.toString(),
    acceptedAt: order.acceptedAt,
    completed: order.completed,
    completedBy: order.completedBy?.toString(),
    completedAt: order.completedAt,
    cancelled: order.cancelled,
    cancelledBy: order.cancelledBy?.toString(),
    cancelledAt: order.cancelledAt,
    deleted: order.deleted,
    deletedBy: order.deletedBy?.toString(),
    deletedAt: order.deletedAt,
    status: order.status,
    createdAt: order.createdAt,
  };
}
