import { IPaymentRepo } from "../infra/repositories/payments";
import { IPaymentProps, Payment, Status } from "../domain/payment";
import { IPayment } from "../infra/database/models/payments";
import { IMessenger } from "../infra/messaging/messenger";
import {  Message } from "amqplib";
import TransferUseCase from "./TransferUseCase";
import crypto from "crypto";
const axios = require("axios").default;
export class PaymentUsecase {
  private paymentRepo: IPaymentRepo;
  messenger: IMessenger
  transferUseCase: TransferUseCase;

  constructor({ payments,  messenger,transferUseCase }: { payments: IPaymentRepo, messenger: IMessenger, transferUseCase: TransferUseCase; }) {
    this.paymentRepo = payments;
    this.messenger = messenger;
    this.transferUseCase = transferUseCase;
  }

  async createPayment(payment: IPaymentProps): Promise<string> {
    const paymentToSave = Payment.create(payment).props;
    const id = this.paymentRepo.save(paymentToSave);
    return id;
  }

  async getpaymentById(id: string): Promise<IPayment | null> {
    const payment = await this.paymentRepo.getPaymentById(id);
    return payment;
  }

  async getpaymentByRef(id: string): Promise<IPayment | null> {
    const payment = await this.paymentRepo.getPaymentByRef(id);
    return payment;
  }

  async consumeOrder(){
    this.messenger.channel.consume(
      "payments",
      (msg: Message | null) => {
        if (msg) {
          
          const data = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey
          console.log(`msg::: ${routingKey}`)
          if(routingKey !== 'orders.status.created'){
            return
          }
          try {
            this.createPayment({
              status: Status.PENDING,
              reference: data.orderID,
              amount: data.amount,
            });
          } catch (err) {
            console.log("err", err);
          }
        }
      },
      { noAck: true }
    );
  }

  async findByRefAndUpdateStatus(
    reference: string,
    status: Status
  ): Promise<void> {
    const payment = await this.paymentRepo.findByRefAndUpdate(
      reference,
      status
    );
  }

  async verifyPayment(ref: string): Promise<boolean>{
    let isVerified = false
    try{
      let result = await axios
      .get(`https://api.paystack.co/transaction/verify/${ref}`, {
        headers: {
          authorization:
            `Bearer ${process.env.PAYSTACK_SECRET}`,
          "content-type": "application/json",
          "cache-control": "no-cache",
        },
      })
    
      const { status, reference } = result.data.data;
      const paidAmt = result.data.data.amount;

      const paymentRecord = await this.getpaymentByRef(
        reference
      );
        
        if (paymentRecord) {
          if (paidAmt == paymentRecord.amount && status === "success") {
            await this.findByRefAndUpdateStatus(
              reference,
              Status.SUCCESS
            );

            isVerified = true
          } else {
            await this.findByRefAndUpdateStatus(
              reference,
              Status.FAILURE
            );
          

            this.messenger.publishToExchange('paymentEvents', 'payments.status.failed', {
              ref: reference
            })

            
        }
      }
    }catch(e){
      return isVerified
    }
      

    return isVerified
  }

  async consumePaystackEvent(paystackReqBody, headers): Promise<boolean> {
    const {event, data} = paystackReqBody

    const secret = process.env.PAYSTACK_SECRET || "";
    var hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(paystackReqBody))
      .digest("hex");

    if (hash == headers["x-paystack-signature"]) {
      // var { event } = req.body;
      
      let ref = data.reference;
      
      try{
      if ((event == "charge.success")) {
        
        
        const paymentRecord = await this.getpaymentByRef(ref);
          if (paymentRecord.amount != data.amount) {
            await this.findByRefAndUpdateStatus(
              ref,
              Status.FAILURE
            );
            
            this.messenger.publishToExchange('paymentEvents', 'payments.status.failed', {
              ref
            })
            
            
            return true
          } else {
            await this.findByRefAndUpdateStatus(
              ref,
              Status.SUCCESS
            );

            this.messenger.publishToExchange('paymentEvents', 'payments.status.success', {
              ref
            })
            
            return true
          }
        
      }else if ((event == "transfer.success")) {
        const withdraw = await this.transferUseCase.findByRefAndUpdateStatus(
          ref,
          Status.SUCCESS
        );
        this.messenger.assertQueue("withdrawal_success");
        this.messenger.sendToQueue("withdrawal_success", { withdraw });
        
      
         return true
      }else if ((event == "transfer.failed")) {
        const withdraw = await this.transferUseCase.findByRefAndUpdateStatus(
              ref,
              Status.FAILURE
            );
        this.messenger.assertQueue("withdrawal_failure");
        this.messenger.sendToQueue("withdrawal_failure", { withdraw })
        return true
      }}
    catch {
    
      return false
    }
      
    }

    return false
  }  
}

export default PaymentUsecase;
