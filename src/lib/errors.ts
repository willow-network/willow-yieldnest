/**
 * Extract a human-readable error message from SDK/axios errors.
 *
 * Axios errors carry the server's response body in `err.response.data`,
 * which for Willow APIs is `{ success: false, error: "..." }`. The default
 * `err.message` is just "Request failed with status code 403" which hides
 * the real error. This helper digs out the server's message.
 */
export function extractErrorMessage(err: unknown): string {
  if (err == null) return 'Unknown error';

  const axiosData = (err as { response?: { data?: { error?: string } } }).response;
  if (axiosData?.data?.error) {
    return axiosData.data.error;
  }

  const code = (err as { code?: string }).code;
  const msg = err instanceof Error ? err.message : String(err);
  return code ? `${msg} [${code}]` : msg;
}
