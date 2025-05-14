import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

/**
 * Catches all exceptions thrown by the application and sends an appropriate HTTP response.
 */
@Catch(UnauthorizedException)
export class UnauthorizedExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(UnauthorizedExceptionsFilter.name);

  /**
   * Creates an instance of `AllExceptionsFilter`.
   *
   * @param {HttpAdapterHost} httpAdapterHost - the HTTP adapter host
   */
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  /**
   * Get client IP address
   *
   * @param {Request} request - Express request object
   * @returns {string} - IP address
   */
  private getClientIp(request): string {
    return (
      request?.ip ||
      (request?.headers["x-forwarded-for"] as string) ||
      request?.socket?.remoteAddress ||
      "unknown"
    );
  }

  /**
   * Catches an exception and sends an appropriate HTTP response.
   *
   * @param {*} exception - the exception to catch
   * @param {ArgumentsHost} host - the arguments host
   * @returns {void}
   */
  catch(exception, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();
    const httpStatus = exception.getStatus();

    const request = ctx.getRequest();

    const clientIp = this.getClientIp(request);
    const userAgent = request.headers["user-agent"] || "unknown";
    const requestUrl = request.url;
    const method = request.method;

    // Log detailed information about the unauthorized access attempt
    this.logger.warn({
      method,
      requestUrl,
      clientIp,
      userAgent,
      traceId: request?.id,
      message: exception?.message,
      description: exception?.description,
      stack: exception?.stack,
    });

    // Construct the response body.
    const responseBody = {
      success: false,
      error: {
        code: httpStatus,
        message:
          exception.message ||
          "Access to the requested resource requires authentication",
        description: exception.description || null,
      },
      timestamp: new Date().toISOString(),
      traceId: request.id,
    };

    // Send the HTTP response.
    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
