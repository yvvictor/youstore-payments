import { Model } from "mongoose";
import { IPaymentProps } from "../../domain/payment";
import { IPayment } from "../database/models/Payments";

export interface IPaymentRepo {
  save(payment: IPaymentProps): Promise<string>;
  getPaymentsByRef(reference: string): Promise<Array<IPayment>>;
  //getPaymentById(id: string): Promise<IPayment | null>;
  findByIdAndUpdate(id: string, paymentStatus: boolean): Promise<void>;
}

export class PaymentRepo implements IPaymentRepo {
  private payments: Model<IPayment>;

  constructor({ paymentModel }: { paymentModel: Model<IPayment> }) {
    this.payments = paymentModel;
  }

  async save(payment: IPaymentProps): Promise<string> {
    //payment.paymentStatus = null;
    const { _id } = await this.payments.create(payment);
    return _id.toString();
  }

  async getPaymentsByRef(reference: string): Promise<Array<IPayment>> {
    const payments = await this.payments.find({ reference }).exec();
    return payments;
  }

  // async getPaymentById(id: string): Promise<IPayment | null> {
  //   const payment = await this.payments.findById(id).exec();
  //   return payment;
  // }

  async findByIdAndUpdate(reference: string, status: boolean): Promise<void> {
    //an array?
    const payment = await this.payments.findByIdAndUpdate(
      reference,
      {
        status,
      },
      { new: true }
    );
  }
}

export default PaymentRepo;
