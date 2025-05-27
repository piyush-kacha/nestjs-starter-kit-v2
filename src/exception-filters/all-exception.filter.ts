import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger, // Using NestJS Logger, which should be configured to use Pino
  UnauthorizedException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { User as PrismaUser } from '@prisma/client'; // For typing request.user

interface ErrorResponse {
  success: boolean;
  error: {
    code: string | number;
    message: string;
    description?: string | object; // HttpException 'response' can be an object
  };
  timestamp: string;
  traceId?: string; // From pino-http
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  // Injecting Logger. If using nestjs-pino, this should be the Pino logger instance.
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(Logger) private readonly logger: Logger,
  ) {}

  private getClientIp(request: any): string {
    return (
      request?.ip ||
      (request?.headers['x-forwarded-for'] as string) ||
      request?.socket?.remoteAddress ||
      'unknown'
    );
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const user = request.user as Omit<PrismaUser, 'passwordHash'> | undefined;

    let httpStatus: HttpStatus;
    let message: string;
    let description: string | object | undefined;
    let errorCode: string | number; // For the 'code' field in the response error object

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const errorObj = exceptionResponse as Record<string, any>;
        message = errorObj.message || exception.message; // Use custom message from response object if available
        description = errorObj.description || errorObj.error || undefined; // Or 'error' for default NestJS errors
        errorCode = errorObj.errorCode || httpStatus; // Custom error code from exception or fallback to status
        // If 'description' is an object, ensure it's not the full exceptionResponse if too verbose
        if (typeof description === 'object' && description !== null && description.hasOwnProperty('statusCode')) {
            description = message; // Avoid overly verbose default NestJS error object in description
        }
      } else {
        message = exception.message;
      }
      errorCode = (exceptionResponse as any)?.errorCode || httpStatus;
    } else {
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal Server Error';
      description = 'An unexpected error occurred.';
      errorCode = 'INTERNAL_SERVER_ERROR';
    }

    const responseBody: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: message,
      },
      timestamp: new Date().toISOString(),
      traceId: request.id, // Assumes pino-http or similar middleware adds 'id' to request
    };
    
    if (description && (httpStatus < 500 || process.env.NODE_ENV !== 'production')) {
      responseBody.error.description = description;
    }
    
    // Structured log object
    const logObject: any = {
      traceId: request.id,
      requestId: request.id, // Redundant with traceId but common practice
      method: request.method,
      url: request.originalUrl || request.url,
      status: httpStatus,
      exceptionType: exception?.constructor?.name,
      errorMessage: (exception as Error)?.message,
      userId: user?.id,
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent'] || 'unknown',
    };

    if (exception instanceof UnauthorizedException) {
      // Specific logging for UnauthorizedException (already part of HttpException handling above)
      // The general logObject already captures method, url, ip, userAgent, traceId.
      // Additional details from UnauthorizedExceptionsFilter are already covered.
      // Ensure message and description are set correctly.
      responseBody.error.message = message || 'Access to the requested resource requires authentication';
      this.logger.warn({ ...logObject, stack: (exception as Error)?.stack }, `Unauthorized access attempt: ${message}`);
    } else if (httpStatus >= 500 || !(exception instanceof HttpException)) {
      // Log full error and stack for server errors or unknown exceptions
      this.logger.error({ ...logObject, stack: (exception as Error)?.stack, error: exception }, `Unhandled exception: ${(exception as Error)?.message}`);
      // For 500 errors in production, do not send potentially sensitive 'description' to client
      if (process.env.NODE_ENV === 'production') {
         responseBody.error.message = 'Internal Server Error'; // Generic message for 500
         delete responseBody.error.description; // Remove description for 500 in prod
      }
    } else {
      // For other HttpExceptions (4xx but not Unauthorized, which is handled above)
      this.logger.warn({ ...logObject, errorDetails: description }, `Handled HTTP exception: ${message}`);
    }

    httpAdapter.reply(response, responseBody, httpStatus);
  }
}
