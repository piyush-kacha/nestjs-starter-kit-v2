import { HttpException, HttpStatus } from "@nestjs/common";

export class InsufficientBalanceException extends HttpException {
  constructor(currentBalance: number, amountToDebit: number) {
    super(
      `Insufficient balance. Current: ${currentBalance}, Tried to debit: ${amountToDebit}`,
      HttpStatus.BAD_REQUEST
    );
  }
}
