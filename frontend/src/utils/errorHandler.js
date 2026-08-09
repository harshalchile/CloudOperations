/**
 * Utility to safely normalize API, AWS, and JavaScript errors into human-readable strings.
 * Guarantees that raw objects (e.g. { code, message, request_id }) are never passed
 * into React components or toast notifications, completely preventing React minified error #31.
 *
 * @param {any} error - The error object, string, or Axios response error
 * @param {string} [fallback='An unexpected error occurred.'] - Default fallback message
 * @returns {string} Safe string error message
 */
export const getErrorMessage = (error, fallback = 'An unexpected error occurred.') => {
  if (!error) return fallback;

  // If already a primitive string
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  // If error is an object (Axios error, AWS error dict, standard Error instance)
  if (typeof error === 'object') {
    // 1. Axios Response payload extraction
    if (error.response && error.response.data) {
      const data = error.response.data;

      if (typeof data === 'string' && data.trim()) {
        return data.trim();
      }

      // Check data.aws_error_message
      if (data.aws_error_message && typeof data.aws_error_message === 'string') {
        return data.aws_error_message;
      }

      // Check data.message
      if (data.message && typeof data.message === 'string' && data.message.trim()) {
        return data.message.trim();
      }

      // Check data.error (can be string or { code, message, request_id })
      if (data.error) {
        if (typeof data.error === 'string' && data.error.trim()) {
          return data.error.trim();
        }
        if (typeof data.error === 'object') {
          if (data.error.message && typeof data.error.message === 'string') {
            return data.error.message;
          }
          if (data.error.code && typeof data.error.code === 'string') {
            return `AWS Error: ${data.error.code}`;
          }
          try {
            return JSON.stringify(data.error);
          } catch {
            // fallback
          }
        }
      }

      // Check data.code
      if (data.code && typeof data.code === 'string') {
        return `AWS Error: ${data.code}`;
      }
    }

    // 2. Direct AWS / Custom Error dict { code, message, request_id }
    if (error.aws_error_message && typeof error.aws_error_message === 'string') {
      return error.aws_error_message;
    }

    if (error.error) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error.trim();
      }
      if (typeof error.error === 'object') {
        if (error.error.message && typeof error.error.message === 'string') {
          return error.error.message;
        }
        if (error.error.code && typeof error.error.code === 'string') {
          return `AWS Error: ${error.error.code}`;
        }
        try {
          return JSON.stringify(error.error);
        } catch {
          // fallback
        }
      }
    }

    if (error.message && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    if (error.code && typeof error.code === 'string') {
      return `AWS Error: ${error.code}`;
    }

    // 3. Fallback stringification
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') return json;
    } catch {
      // ignore
    }
  }

  return String(error || fallback);
};

export default getErrorMessage;
