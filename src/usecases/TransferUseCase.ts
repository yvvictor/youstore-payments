import { ITransferRepo } from "../infra/repositories/transfers";
import { ITransferProps, Transfer, Status } from "../domain/transfer";
import { ITransfer } from "../infra/database/models/transfers";
const axios = require("axios").default;
export class TransferUsecase {
  private transferRepo: ITransferRepo;

  constructor({ transfers }: { transfers: ITransferRepo }) {
    this.transferRepo = transfers;
  }

  async createTransfer(transfer: ITransferProps, bank_code: string, name: string): Promise<string> {
   
    try{
      const transferToSave = Transfer.create(transfer).props;
      const transferID  = await this.transferRepo.save(transferToSave);
      const {accName, accNo, amount} = transfer
      await axios
      .get(`https://api.paystack.co/bank/resolve?account_number=${accNo}&bank_code=${bank_code}`, {
        headers: {
          authorization:
            `Bearer ${process.env.PAYSTACK_SECRET}`,
          "content-type": "application/json",
          "cache-control": "no-cache",
        },
      })
    

      const recipientResponse = await axios.post(
        `https://api.paystack.co/transferrecipient`,
        {
          type: "nuban", 
          name, 
          account_number: accNo, 
          bank_code: bank_code, 
          currency: "NGN"
        },
        {
          headers: {
            authorization:
              `Bearer ${process.env.PAYSTACK_SECRET}`,
            "content-type": "application/json",
            "cache-control": "no-cache",
          },
        }
      );

      const recipient_code = recipientResponse.data.data.recipient_code
    
      const makeTransfer = await axios.post(
        `https://api.paystack.co/transfer`,
        {
          source: "balance", 
          amount, 
          recipient: recipient_code, 
          reason: "Youstore payment",
          reference: transferID
        },
        {
          headers: {
            authorization:
              `Bearer ${process.env.PAYSTACK_SECRET}`,
            "content-type": "application/json",
            "cache-control": "no-cache",
          },
        }
      );


      return transferID
    }catch(err){
      throw err
    }
  }

  async gettransferById(id: string): Promise<ITransfer | null> {
    const transfer = await this.transferRepo.getTransferById(id);
    return transfer;
  }


  async gettransferByCustomer(id: string): Promise<ITransfer[] | null> {
    const transfer = await this.transferRepo.getTransferByCustomer(id);
    return transfer;
  }

  async findByRefAndUpdateStatus(
    reference: string,
    status: Status
  ): Promise<ITransfer | null> {
    const transfer = await this.transferRepo.findByRefAndUpdate(
      reference,
      status
    );

    return transfer
  }
}

export default TransferUsecase;
