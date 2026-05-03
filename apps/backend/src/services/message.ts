import { Message } from '../models/Message';

export async function sendMessage(senderId: string, content: string) {
  return Message.create({ sender: senderId, recipient: 'aaaaaaaaaaaaaaaaaaaaaaaa', content });
}

export async function getUserMessages(userId: string) {
  return Message.find({ $or: [ { sender: userId }, { recipient: userId } ], deleted: { $ne: true } });
}

export async function getAllMessages() {
  return Message.find();
}

export async function deleteMessage(messageId: string, adminId: string) {
  return Message.findByIdAndUpdate(messageId, { deleted: true, deletedBy: adminId, deletedAt: new Date() }, { new: true });
}

export async function sendAdminMessage(adminId: string, recipientId: string, content: string) {
  return Message.create({ sender: adminId, recipient: recipientId, content });
}

export async function markMessageRead(messageId: string, userId: string) {
  return Message.findByIdAndUpdate(messageId, { read: true, readAt: new Date(), readBy: userId }, { new: true });
}
