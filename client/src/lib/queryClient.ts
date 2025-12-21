import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  details?: any;
  [key: string]: any;

  constructor(status: number, message: string, errorData?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    
    // Preserve all fields from server response verbatim
    if (errorData) {
      Object.assign(this, errorData);
    }
    
    // Ensure HTTP status is not overwritten by server payload
    this.status = status;
  }
}

// Simple check that doesn't consume the body - leaves it for apiRequest to handle
function checkResponseOk(res: Response) {
  if (!res.ok) {
    return false;
  }
  return true;
}

// Parse error response and create ApiError
async function parseErrorResponse(res: Response): Promise<ApiError> {
  const text = (await res.text()) || res.statusText;
  
  try {
    const errorData = JSON.parse(text);
    const message = errorData.message || errorData.error || text;
    return new ApiError(res.status, message, errorData);
  } catch {
    // Plain text error
    return new ApiError(res.status, `${res.status}: ${text}`);
  }
}

interface ApiRequestOptions {
  raw?: boolean;
}

// Overload for raw Response mode
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  options?: { raw: true }
): Promise<Response>;

// Overload for parsed JSON mode (default)
export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown,
  options?: { raw?: false }
): Promise<T>;

// Implementation
export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown,
  options?: ApiRequestOptions
): Promise<T | Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Check if response is OK
  if (!checkResponseOk(res)) {
    // For raw mode, throw after cloning to preserve body
    if (options?.raw) {
      const apiError = await parseErrorResponse(res.clone());
      throw apiError;
    }
    // For JSON mode, consume body to create error
    const apiError = await parseErrorResponse(res);
    throw apiError;
  }
  
  // Raw mode: return Response as-is (body intact)
  if (options?.raw) {
    return res;
  }
  
  // JSON mode: parse and return
  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }
  
  // Parse JSON response
  try {
    return await res.json() as T;
  } catch {
    // Empty body or invalid JSON
    return undefined as T;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!checkResponseOk(res)) {
      const apiError = await parseErrorResponse(res);
      throw apiError;
    }
    
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
