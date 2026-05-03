import { Item, ItemDocument } from '../models/Item';
import { CreateItemRequest } from '../dtos/item.dto';
import mongoose from 'mongoose';

export const getActiveItems = async (): Promise<ItemDocument[]> => {
    return Item.find({ deleted: false, deactivated: false });
};

export const getAllItems = async (): Promise<ItemDocument[]> => {
    return Item.find();
}

export const createItem = async (data: CreateItemRequest, userId: string): Promise<ItemDocument> => {
    return Item.create({
        ...data,
        ...(data.activated ? {
            activated: true,
            activatedBy: new mongoose.Types.ObjectId(userId),
            activatedAt: new Date(),
        } : null),
    });
};

export const updateItem = async (id: string, data: Partial<Omit<CreateItemRequest, "activated">>, userId: string): Promise<ItemDocument | null> => {
    return Item.findByIdAndUpdate(
        {
            _id: id,
            deleted: { $ne: true }
        },
        {
            ...data,
            edited: true,
            editedAt: new Date(),
            editedBy: userId
        }, { new: true });
};

export const disableItem = async (id: string, userId: string): Promise<ItemDocument | null> => {
    return Item.findByIdAndUpdate(
        {
            _id: id,
            deleted: { $ne: true },
            disabled: { $ne: true }
        }, {
        deactivated: true,
        deactivatedBy: userId,
        deactivatedAt: new Date(),
        activated: false,
        $unset: { activatedBy: "", activatedAt: "" }
    }, { new: true });
};

export const enableItem = async (id: string, userId: string): Promise<ItemDocument | null> => {
    return Item.findByIdAndUpdate({
        _id: id,
        deleted: { $ne: true },
        enabled: { $ne: true }
    }, {
        activated: true,
        activatedBy: userId,
        activatedAt: new Date(),
        deactivated: false,
        $unset: { deactivatedBy: "", deactivatedAt: "" }
    }, { new: true });
};

export const deleteItem = async (id: string, userId: string): Promise<ItemDocument | null> => {
    return Item.findByIdAndUpdate({
        _id: id,
        deleted: { $ne: true },
    }, { deleted: true, deletedBy: userId, deletedAt: new Date() }, { new: true });
};

export const getCostForItems = async (itemIds: string[]): Promise<Record<string, number>> => {
    // Example implementation: fetch items and map their costs
    const items = await Item.find({ _id: { $in: itemIds }, deleted: { $ne: true }, activated: true });
    const costMap: { [key: string]: number } = {};
    items.forEach(item => {
        costMap[item._id.toString()] = item.cost ?? 0;
    });
    return costMap;
}
