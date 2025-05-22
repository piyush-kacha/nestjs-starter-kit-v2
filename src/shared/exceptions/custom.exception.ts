import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Example custom exception.
 * This can be used for specific business logic errors where a unique errorCode is beneficial.
 */
export class MyCustomException extends HttpException {
  constructor(message: string, errorCode: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    // The response object passed to super() will be available in AllExceptionsFilter
    // when handling HttpException instances.
    super(
      { 
        message: message || 'A custom error occurred.', 
        errorCode: errorCode || 'CUSTOM_ERROR', // Custom error code
        statusCode: statusCode 
      }, 
      statusCode
    );
  }
}

// Example of another custom exception for a more specific case
export class InsufficientBalanceException extends MyCustomException {
  constructor(currentBalance: number, amountToDeduct: number) {
    super(
      `Insufficient balance. Current: ${currentBalance}, Required: ${amountToDeduct}.`, 
      'INSUFFICIENT_BALANCE',
      HttpStatus.PAYMENT_REQUIRED // Or another appropriate status
    );
  }
}
