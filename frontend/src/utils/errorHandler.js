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

  // 1. Primitive types
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error);
  }

  // 2. Object handling
  if (typeof error === 'object') {
    // 2a. Axios Response payload extraction
    if (error.response && error.response.data) {
      const data = error.response.data;

      if (typeof data === 'string' && data.trim()) {
        return data.trim();
      }

      if (data.aws_error_message && typeof data.aws_error_message === 'string' && data.aws_error_message.trim()) {
        return data.aws_error_message.trim();
      }

      if (data.message && typeof data.message === 'string' && data.message.trim()) {
        return data.message.trim();
      }

      if (data.error) {
        if (typeof data.error === 'string' && data.error.trim()) {
          return data.error.trim();
        }
        if (typeof data.error === 'object') {
          if (data.error.message && typeof data.error.message === 'string' && data.error.message.trim()) {
            return data.error.message.trim();
          }
          if (data.error.code && typeof data.error.code === 'string' && data.error.code.trim()) {
            return `AWS Error: ${data.error.code.trim()}`;
          }
          try {
            const str = JSON.stringify(data.error);
            if (str && str !== '{}') return str;
          } catch {
            // fallback
          }
        }
      }

      if (data.code && typeof data.code === 'string' && data.code.trim()) {
        return `AWS Error: ${data.code.trim()}`;
      }
    }

    // 2b. Direct AWS / Custom Error dict { code, message, request_id } or { error: { ... } }
    if (error.aws_error_message && typeof error.aws_error_message === 'string' && error.aws_error_message.trim()) {
      return error.aws_error_message.trim();
    }

    if (error.error) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error.trim();
      }
      if (typeof error.error === 'object') {
        if (error.error.message && typeof error.error.message === 'string' && error.error.message.trim()) {
          return error.error.message.trim();
        }
        if (error.error.code && typeof error.error.code === 'string' && error.error.code.trim()) {
          return `AWS Error: ${error.error.code.trim()}`;
        }
        try {
          const str = JSON.stringify(error.error);
          if (str && str !== '{}') return str;
        } catch {
          // fallback
        }
      }
    }

    if (error.message && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    if (error.code && typeof error.code === 'string' && error.code.trim()) {
      return `AWS Error: ${error.code.trim()}`;
    }

    // 2c. Fallback stringification for arbitrary plain objects
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') return json;
    } catch {
      // ignore
    }
  }

  const str = String(error);
  return str && str !== '[object Object]' ? str : fallback;
};

export default getErrorMessage;
