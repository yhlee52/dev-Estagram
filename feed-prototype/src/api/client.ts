import { getApiBaseUrl } from "../config/apiConfig";

interface ApiErrorBody {
  detail?: unknown;
  message?: unknown;
}

export class ApiClientError extends Error {
  status: number;
  statusText: string;
  body: unknown;

  constructor(message: string, status: number, statusText: string, body: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export class ApiNetworkError extends Error {
  cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "ApiNetworkError";
    this.cause = cause;
  }
}

const buildApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
};

const getErrorMessage = (
  body: unknown,
  status: number,
  statusText: string,
): string => {
  if (typeof body === "object" && body !== null) {
    const errorBody = body as ApiErrorBody;

    if (typeof errorBody.detail === "string") {
      return errorBody.detail;
    }

    if (Array.isArray(errorBody.detail)) {
      const firstDetail = errorBody.detail[0];

      if (
        typeof firstDetail === "object" &&
        firstDetail !== null &&
        "msg" in firstDetail &&
        typeof firstDetail.msg === "string"
      ) {
        return firstDetail.msg;
      }

      return "Request validation failed.";
    }

    if (typeof errorBody.message === "string") {
      return errorBody.message;
    }
  }

  return `API request failed with ${status} ${statusText}`;
};

const readJsonBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    throw new ApiNetworkError("Could not reach the feed API.", error);
  }

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new ApiClientError(
      getErrorMessage(body, response.status, response.statusText),
      response.status,
      response.statusText,
      body,
    );
  }

  return body as T;
};

export const apiGet = async <T>(path: string): Promise<T> => apiRequest<T>(path);

export const apiPost = async <T>(
  path: string,
  body?: unknown,
): Promise<T> =>
  apiRequest<T>(path, {
    method: "POST",
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
        }),
  });

export const apiPatch = async <T>(
  path: string,
  body?: unknown,
): Promise<T> =>
  apiRequest<T>(path, {
    method: "PATCH",
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
        }),
  });

export const apiDelete = async <T>(path: string): Promise<T> =>
  apiRequest<T>(path, { method: "DELETE" });
