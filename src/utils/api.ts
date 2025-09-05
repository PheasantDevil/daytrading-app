import { ApiResponse } from '@/types';

export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  message?: string
): ApiResponse<T> {
  return {
    success,
    data,
    error,
    message,
  };
}

export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiResponse<T> {
  return createApiResponse(true, data, undefined, message);
}

export function createErrorResponse(
  error: string,
  message?: string
): ApiResponse<never> {
  return createApiResponse(false, undefined, error, message);
}
