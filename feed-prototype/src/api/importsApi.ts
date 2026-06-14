import { apiGet } from "./client";
import type {
  ApiImportBatchDetailResponse,
  ApiImportBatchListResponse,
  ApiImportBatchSummary,
} from "./types";

/**
 * Import batch history (v0.3.1). API mode only — these endpoints surface the
 * server-side `import_batch` records written when external packages are
 * imported over CLI or HTTP.
 */
export const getImports = async (): Promise<ApiImportBatchSummary[]> => {
  const response = await apiGet<ApiImportBatchListResponse>("/api/imports");
  return response.items;
};

export const getImport = async (
  batchExternalId: string,
): Promise<ApiImportBatchDetailResponse> =>
  apiGet<ApiImportBatchDetailResponse>(
    `/api/imports/${encodeURIComponent(batchExternalId)}`,
  );
