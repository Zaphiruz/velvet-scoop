import { Request, Response } from 'express';
import { CreateOrderRequest, OrderResponse, toOrderResponse } from '../dtos/requests.dto';
import {
    getUserRequests,
    cancelUserRequest,
    createUserRequest,
    getAllRequests,
    acceptRequest,
    cancelRequest,
    deleteRequest,
    deleteUserRequest,
    completeOrder,
} from '../services/request';

// Admin completes an order
export const completeOrderController = async (req: Request, res: Response) => {
    const admin = req.user;
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }
    const order = await completeOrder(admin._id.toString(), id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(toOrderResponse(order));
};

export const deleteMyOrder = async (req: Request, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }
    const order = await deleteUserRequest(user._id.toString(), id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(toOrderResponse(order));
};


export const createMyOrder = async (req: Request, res: Response) => {
    const user = req.user;
    const data: CreateOrderRequest = req.body;
    if (!data) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }
    if (!data.contact) {
        data.contact = {
            name: user.name,
            email: user.email,
        };
    } else if (!data.contact.name) {
        data.contact.name = user.name;
    } else if (!data.contact.email) {
        data.contact.email = user.email;
    }
    // Optionally validate required fields here
    const order = await createUserRequest(user._id.toString(), data);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.status(201).json(toOrderResponse(order));
};

export const getMyOrders = async (req: Request, res: Response) => {
    const user = req.user;
    const orders = await getUserRequests(user._id.toString());
    res.json(orders.map(toOrderResponse));
};


export const cancelMyOrder = async (req: Request, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }
    const order = await cancelUserRequest(user._id.toString(), id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(toOrderResponse(order));
};

export const getAllOrders = async (req: Request, res: Response) => {
    const orders = await getAllRequests();
    res.json(orders.map(toOrderResponse));
};


export const acceptOrder = async (req: Request, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    const order = await acceptRequest(user._id.toString(), id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(toOrderResponse(order));
};


export const cancelOrder = async (req: Request, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    const order = await cancelRequest(user._id.toString(), id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(toOrderResponse(order));
};


export const deleteOrder = async (req: Request, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    const order = await deleteRequest(user._id.toString(), id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(toOrderResponse(order));
};
