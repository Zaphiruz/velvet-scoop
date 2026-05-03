import { createMyOrder, getMyOrders, cancelMyOrder, getAllOrders, acceptOrder, cancelOrder, deleteOrder, deleteMyOrder, completeOrderController } from './requestController';
import * as requestService from '../services/request';
import { Request, Response } from 'express';

describe('requestController', () => {
  const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('should createMyOrder and return 404 if not found', async () => {
  jest.spyOn(requestService, 'createUserRequest').mockResolvedValue(undefined as any);
    const req: any = { user: { _id: 'u1' }, body: {} };
    const res = mockRes();
    await createMyOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // Add similar tests for all other controller methods
});
