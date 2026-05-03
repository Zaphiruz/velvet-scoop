import { Request, Response } from 'express';
import { sendMessage, getUserMessages, getAllMessages, deleteMessage, sendAdminMessage, markMessageRead } from '../services/message';

import { CreateMessageRequest, MessageResponse, toMessageResponse } from '../dtos/message.dto';

export const sendUserMessage = async (req: Request, res: Response) => {
    const user = req.user;
    if (user.muted) {
        return res.status(403).json({ message: 'You are muted and cannot send messages.' });
    }

    const data: CreateMessageRequest = req.body;
    if (!data.content) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }
    const message = await sendMessage(user._id.toString(), data.content);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    res.status(201).json(toMessageResponse(message));
};

export const getMyMessages = async (req: Request, res: Response) => {
    const user = req.user;
    const messages = await getUserMessages(user._id.toString());
    // Mark unread messages as read
    await Promise.all(messages.filter(m => !m.read && m.recipient == user._id.toString()).map(m => markMessageRead(m._id.toString(), user._id.toString())));
    res.json(messages.map(toMessageResponse));
};

export const getAllMessagesAdmin = async (req: Request, res: Response) => {
    const messages = await getAllMessages();
    const user = req.user;
    await Promise.all(messages.filter(m => !m.read && (m.recipient == user._id && m.recipient.toString() == 'aaaaaaaaaaaaaaaaaaaaaaaa')).map(m => markMessageRead(m._id.toString(), user._id.toString())));
    res.json(messages.map(toMessageResponse));
};

export const deleteMessageAdmin = async (req: Request, res: Response) => {
    const admin = req.user;
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }
    const message = await deleteMessage(id, admin._id.toString());
    if (!message) return res.status(404).json({ message: 'Message not found' });
    res.json(toMessageResponse(message));
};

export const sendAdminMessageController = async (req: Request, res: Response) => {
    const admin = req.user;
    const { recipientId } = req.params;
    const data: MessageResponse = req.body;
    if (!recipientId || !data.content) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }
    const message = await sendAdminMessage(admin._id.toString(), recipientId, data.content);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    res.status(201).json(toMessageResponse(message));
};
