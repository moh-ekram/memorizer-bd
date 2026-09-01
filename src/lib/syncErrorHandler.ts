/**
 * Comprehensive Database & Cloud Sync Error Classification & Handshake Diagnostic Utility
 * Identifies network drops, credential rejections, RLS denials, and schema errors with actionable remedies.
 */

export interface DetailedSyncError {
  category: 'CREDENTIAL_REJECTION' | 'NETWORK_FAILURE' | 'RLS_PERMISSION_DENIED' | 'SCHEMA_NOT_FOUND' | 'RATE_LIMITED' | 'UNKNOWN';
  title: string;
  description: string;
  remedy: string;
  statusCode?: number;
  errorCode?: string;
  rawError: any;
  timestamp: string;
}

export function classifySyncError(err: any): DetailedSyncError {
  const timestamp = new Date().toISOString();
  const rawMsg = String(err?.message || err?.error_description || err?.details || (typeof err === 'string' ? err : '') || JSON.stringify(err));
  const errCode = String(err?.code || err?.statusCode || err?.status || '');
  const httpStatus = typeof err?.status === 'number' ? err.status : (typeof err?.statusCode === 'number' ? err.statusCode : undefined);

  // 1. Credential Rejections (Invalid API Key, Expired JWT, Unauthorized)
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    errCode === 'PGRST301' ||
    errCode === 'invalid_api_key' ||
    rawMsg.includes('Invalid API key') ||
    rawMsg.includes('invalid claim') ||
    rawMsg.includes('JWT expired') ||
    rawMsg.includes('Unauthorized') ||
    rawMsg.includes('Forbidden') ||
    rawMsg.includes('invalid_grant') ||
    rawMsg.includes('bad_jwt') ||
    rawMsg.includes('apiKey is invalid')
  ) {
    return {
      category: 'CREDENTIAL_REJECTION',
      title: 'Database Credentials Rejected',
      description: `The database provider rejected authentication during the handshake: ${rawMsg || 'Invalid API Key or expired JWT token.'}`,
      remedy: 'Please check your Supabase Anon/Service Key in Admin Panel > Cloud Migration or update VITE_SUPABASE_ANON_KEY in your environment.',
      statusCode: httpStatus || 401,
      errorCode: errCode || 'CREDENTIAL_INVALID',
      rawError: err,
      timestamp
    };
  }

  // 2. Network connectivity failures & unreachable backend
  if (
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('NetworkError') ||
    rawMsg.includes('Network request failed') ||
    rawMsg.includes('ERR_NAME_NOT_RESOLVED') ||
    rawMsg.includes('ERR_CONNECTION_REFUSED') ||
    rawMsg.includes('ENOTFOUND') ||
    rawMsg.includes('FetchError') ||
    rawMsg.includes('timeout') ||
    err?.name === 'TypeError' && rawMsg.includes('fetch')
  ) {
    return {
      category: 'NETWORK_FAILURE',
      title: 'Database Host Unreachable',
      description: `Network handshake failed with the database server: ${rawMsg || 'Unable to establish HTTP/WebSocket connection.'}`,
      remedy: 'Check your internet connection or verify that the Supabase host URL is correct and not paused.',
      statusCode: httpStatus || 0,
      errorCode: errCode || 'NETWORK_ERROR',
      rawError: err,
      timestamp
    };
  }

  // 3. Row Level Security (RLS) or PostgreSQL Permission Denials
  if (
    errCode === '42501' ||
    errCode === 'PGRST302' ||
    rawMsg.includes('row-level security') ||
    rawMsg.includes('permission denied') ||
    rawMsg.includes('violates row-level security policy')
  ) {
    return {
      category: 'RLS_PERMISSION_DENIED',
      title: 'Row Level Security Policy Blocked Request',
      description: `PostgreSQL RLS policy denied the operation: ${rawMsg}`,
      remedy: 'Execute the Supabase RLS setup script from Admin Panel > Cloud Migration > Setup SQL.',
      statusCode: httpStatus || 403,
      errorCode: errCode || '42501',
      rawError: err,
      timestamp
    };
  }

  // 4. Missing Relation or Schema Table
  if (
    errCode === '42P01' ||
    errCode === 'PGRST204' ||
    rawMsg.includes('relation') && rawMsg.includes('does not exist') ||
    rawMsg.includes('table') && rawMsg.includes('not found')
  ) {
    return {
      category: 'SCHEMA_NOT_FOUND',
      title: 'Database Table Not Found',
      description: `The requested PostgreSQL table does not exist: ${rawMsg}`,
      remedy: 'Run the complete table migration script in your Supabase SQL editor.',
      statusCode: httpStatus || 404,
      errorCode: errCode || '42P01',
      rawError: err,
      timestamp
    };
  }

  // 5. Rate Limit Rejections
  if (httpStatus === 429 || rawMsg.includes('Too Many Requests') || rawMsg.includes('rate limit')) {
    return {
      category: 'RATE_LIMITED',
      title: 'Database Rate Limit Reached',
      description: `Database provider throttled requests: ${rawMsg}`,
      remedy: 'The system will back off and retry automatically.',
      statusCode: 429,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      rawError: err,
      timestamp
    };
  }

  // 6. Generic/Unknown error
  return {
    category: 'UNKNOWN',
    title: 'Cloud Synchronization Warning',
    description: rawMsg || 'An unexpected error occurred during database synchronization.',
    remedy: 'Inspect the browser console for full stack trace or perform a manual sync.',
    statusCode: httpStatus,
    errorCode: errCode || 'UNKNOWN_ERROR',
    rawError: err,
    timestamp
  };
}

export function logSyncErrorToConsole(context: string, classified: DetailedSyncError) {
  const icon = 
    classified.category === 'CREDENTIAL_REJECTION' ? '🔑' :
    classified.category === 'NETWORK_FAILURE' ? '📡' :
    classified.category === 'RLS_PERMISSION_DENIED' ? '🛡️' :
    classified.category === 'SCHEMA_NOT_FOUND' ? '🗄️' : '⚠️';

  console.error(
    `%c${icon} [Cloud Sync Error: ${classified.category}] in ${context}%c\n` +
    `  • Title: ${classified.title}\n` +
    `  • Details: ${classified.description}\n` +
    `  • Actionable Remedy: ${classified.remedy}\n` +
    `  • Code/Status: ${classified.errorCode || 'N/A'} (${classified.statusCode || 'N/A'})\n` +
    `  • Timestamp: ${classified.timestamp}`,
    'color: #ef4444; font-weight: bold; font-size: 12px;',
    'color: #f87171;',
    classified.rawError
  );
}
