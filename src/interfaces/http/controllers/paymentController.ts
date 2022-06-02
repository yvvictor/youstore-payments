import { Request, Response } from "express";
import { IMessenger } from "../../../infra/messaging/messenger";
import PaymentUseCase from "../../../usecases/PaymentUseCase";
import TransferUseCase from "../../../usecases/TransferUseCase"
import { Status } from "../../../domain/payment";
import crypto from "crypto";
const axios = require("axios").default;

export class PaymentController {
  paymentUseCase: PaymentUseCase;
  transferUseCase: TransferUseCase;
  messenger: IMessenger;

  constructor({
    paymentUseCase,
    transferUseCase,
    messenger,
  }: {
    paymentUseCase: PaymentUseCase;
    transferUseCase: TransferUseCase;
    messenger: IMessenger;
  }) {
    this.paymentUseCase = paymentUseCase;
    this.transferUseCase = transferUseCase;
    this.messenger = messenger;
  }

  async getpaymentById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const order = await this.paymentUseCase.getpaymentById(id);
      res.status(200).json({ success: true, data: order });
    } catch ({ name, message }) {
      res.status(404).json({ success: false, data: null });
    }
  }

  async getpaymentByRef(req: Request, res: Response): Promise<void> {
    const { reference } = req.params;
    try {
      const order = await this.paymentUseCase.getpaymentByRef(reference);
      if (!order) {
        res.status(404).json({ success: true, data: null });
      }
      res.status(200).json({ success: true, data: order });
    } catch ({ name, message }) {
      res.status(404).json({ success: false, data: null });
    }
  }
  
  async verifyPayment(req: Request, res: Response) {
    const reference: string = req.params.reference;
    try{
      const isVerified = await this.paymentUseCase.verifyPayment(reference)
      if(!isVerified){
        throw Error('Payment verification failed')
      }

      res.json({success: true,
        message: "Payment was successful",
        data: reference})
    }catch(e){
      let message  = e.message
      res.json({
        success: false,
        message,
    })
    }
   
   
  }

  async bankTransfer(req: Request, res: Response) {
    const {acc_name, account_number, bank_code, amount, customerId, name} = req.body
    try{
      const transfer = {amount,customerId, status: Status.PENDING, accName: acc_name, accNo: account_number}
      const transferID = await this.transferUseCase.createTransfer( transfer, bank_code, name)
      res.status(200).json({message:'transfer successful',data:{reference:transferID}})
    }catch(e){
      return res.status(400).json({message:'transfer failed',data:null})
    }
  }

  async consumePaystackEvent(req: Request, res: Response): Promise<void> {
    const {event, data} = req.body   
    try{
      const isConsumed = await this.paymentUseCase.consumePaystackEvent({event,data}, req.headers)
      if(!isConsumed){
        throw Error
      }
      res.status(200).send({ success: true });
    }catch{
      res.status(400).send({ success: false });
    } 
  }

  
}

export default PaymentController;
