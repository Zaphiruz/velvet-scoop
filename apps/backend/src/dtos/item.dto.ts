// Item DTOs and types

export interface CreateItemRequest {
    name: string;
    description: string;
    nutritionalFacts: string;
    ingredients: string;
    allergyInformation: string;
    isSeasonal: boolean;
    cost: number;
    activated: boolean;
}

export interface ItemResponse {
    _id: string;
    name: string;
    description: string;
    nutritionalFacts: string;
    ingredients: string;
    allergyInformation: string;
    isSeasonal: boolean;
    cost: number;
    activated: boolean;
    activatedAt?: Date;
    activatedBy?: string;
    deactivated: boolean;
    deactivatedAt?: Date;
    deactivatedBy?: string;
    deleted: boolean;
    deletedAt?: Date;
    deletedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

export function toItemResponse(item: any): ItemResponse {
    return {
        _id: item._id,
        name: item.name,
        description: item.description,
        nutritionalFacts: item.nutritionalFacts,
        ingredients: item.ingredients,
        allergyInformation: item.allergyInformation,
        isSeasonal: item.isSeasonal,
        cost: item.cost,
        activated: item.activated,
        activatedAt: item.activatedAt,
        activatedBy: item.activatedBy?.toString(),
        deactivated: item.deactivated,
        deactivatedAt: item.deactivatedAt,
        deactivatedBy: item.deactivatedBy?.toString(),
        deleted: item.deleted,
        deletedAt: item.deletedAt,
        deletedBy: item.deletedBy?.toString(),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    };
}


