import { useMemo } from 'react';

function buildJsonPreview(content) {
  if (!content) {
    return { isEmpty: true, isValid: false, formatted: '', error: '' };
  }

  try {
    const formatted = JSON.stringify(JSON.parse(content), null, 2);
    return { isEmpty: false, isValid: true, formatted, error: '' };
  } catch (error) {
    return { isEmpty: false, isValid: false, formatted: content, error: error.message };
  }
}

function renderJsonTokens(content) {
  const tokenPattern = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?=\s*:)|"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|[{}\[\],:])/g;
  const parts = [];
  let lastIndex = 0;

  for (const match of content.matchAll(tokenPattern)) {
    const [token] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(content.slice(lastIndex, index));
    let className = 'json-token-punctuation';
    if (token.startsWith('"')) className = token.endsWith(':') ? 'json-token-key' : 'json-token-string';
    if (/^-?\d/.test(token)) className = 'json-token-number';
    if (token === 'true' || token === 'false') className = 'json-token-boolean';
    if (token === 'null') className = 'json-token-null';
    parts.push(<span key={`${index}-${token}`} className={className}>{token}</span>);
    lastIndex = index + token.length;
  }

  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

function JsonViewer({ content }) {
  const preview = useMemo(() => buildJsonPreview(content), [content]);

  if (preview.isEmpty) return <p className="viewer-empty">No response body available.</p>;

  return (
    <div className="response-viewer-panel">
      <div className="viewer-status-row"><span className={`badge badge-${preview.isValid ? 'green' : 'red'}`}>{preview.isValid ? 'Valid JSON' : 'Invalid JSON'}</span>{preview.error && <span className="viewer-error-text">{preview.error}</span>}</div>
      <pre className="json-viewer">{renderJsonTokens(preview.formatted)}</pre>
    </div>
  );
}

function HtmlViewer({ content }) {
  if (!content) return <p className="viewer-empty">No response body available.</p>;

  return (
    <iframe
      title="HTML response body viewer"
      className="response-preview-frame"
      sandbox=""
      srcDoc={content}
    />
  );
}

function PreviewPanel({ detail, viewerMode }) {
  const hasFullContent = Boolean(detail?.full_response_body);
  const content = hasFullContent ? detail.full_response_body : (detail?.response_snippet || '');
  const isPreviewFallback = !hasFullContent && Boolean(detail?.response_snippet);

  return (
    <>
      {isPreviewFallback && <p className="viewer-fallback-note">Full response body unavailable. Showing stored response preview.</p>}
      {viewerMode === 'html' ? <HtmlViewer content={content} /> : <JsonViewer content={content} />}
    </>
  );
}

export default function ResponsePreviewModal({
  detail,
  error,
  loading,
  onClose,
  onViewerChange,
  viewerMode,
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card response-modal" role="dialog" aria-modal="true" aria-labelledby="response-content-title">
        <div className="modal-header"><div><h2 id="response-content-title">Response Body / Content</h2><p className="page-desc">Full response body or page content fetched on demand for this request log.</p></div><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button></div>
        <div className="viewer-toggle-row"><button type="button" className={`btn btn-sm ${viewerMode === 'json' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onViewerChange('json')}>JSON Viewer</button><button type="button" className={`btn btn-sm ${viewerMode === 'html' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onViewerChange('html')}>HTML Viewer</button></div>
        {loading ? <div className="page-loader">Loading preview...</div> : error ? <div className="form-error">{error}</div> : <PreviewPanel detail={detail} viewerMode={viewerMode} />}
      </div>
    </div>
  );
}