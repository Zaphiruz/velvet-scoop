// Message DTOs and types

export interface CreateMessageRequest {
  content: string;
}

export interface MessageResponse {
  _id: string;
  sender: string;
  recipient: string;
  content: string;
  read: boolean;
  readAt?: Date;
  readBy?: string;
  deleted?: boolean;
  deletedBy?: string;
  deletedAt?: Date;
  createdAt: Date;
}

export function toMessageResponse(message: any): MessageResponse {
  return {
    _id: message._id,
    sender: message.sender?.toString(),
    recipient: message.recipient?.toString(),
    content: message.content,
    read: message.read,
    readAt: message.readAt,
    readBy: message.readBy?.toString(),
    deleted: message.deleted,
    deletedBy: message.deletedBy?.toString(),
    deletedAt: message.deletedAt,
    createdAt: message.createdAt,
  };
}
