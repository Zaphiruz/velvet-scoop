import { Request, Response } from 'express';
import {
    getActiveItems,
    getAllItems as adminGetAllItems,
    createItem as adminCreateItem,
    updateItem as adminUpdateItem,
    disableItem as adminDisableItem,
    enableItem as adminEnableItem,
    deleteItem as adminDeleteItem
} from '../services/item';
import { toItemResponse } from '../dtos/item.dto';

export const getItems = async (req: Request, res: Response) => {
    const items = await getActiveItems();
    res.json(items.map(toItemResponse));
};

export const getAllItems = async (req: Request, res: Response) => {
    const items = await adminGetAllItems();
    res.json(items.map(toItemResponse));
}

export const createItem = async (req: Request, res: Response) => {
    const item = await adminCreateItem(req.body, req.user?._id);
    res.status(201).json(toItemResponse(item));
};

export const updateItem = async (req: Request, res: Response) => {
    if (!req.params.id) {
        return res.status(400).json({ error: 'Missing item id parameter' });
    }
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'No fields provided for update' });
    }
    const allowed = ['name', 'description', 'nutritionalFacts', 'ingredients', 'allergyInformation', 'isSeasonal', 'cost', 'activated', 'deactivated', 'deleted'];
    const update: any = {};
    for (const key of Object.keys(req.body)) {
        if (allowed.includes(key)) {
            update[key] = req.body[key];
        }
    }
    if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update' });
    }
    const item = await adminUpdateItem(req.params.id, update, req.user?._id);
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(toItemResponse(item));
};

export const disableItem = async (req: Request, res: Response) => {
    if (!req.params.id) {
        return res.status(400).json({ error: 'Missing item id parameter' });
    }
    const item = await adminDisableItem(req.params.id, req.user?._id);
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(toItemResponse(item));
};

export const enableItem = async (req: Request, res: Response) => {
    if (!req.params.id) {
        return res.status(400).json({ error: 'Missing item id parameter' });
    }
    const item = await adminEnableItem(req.params.id, req.user?._id);
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(toItemResponse(item));
};

export const deleteItem = async (req: Request, res: Response) => {
    if (!req.params.id) {
        return res.status(400).json({ error: 'Missing item id parameter' });
    }
    const item = await adminDeleteItem(req.params.id, req.user?._id);
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(toItemResponse(item));
};
