import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import './RequestLogsPage.css';
import RequestLogsControls from './requestLogs/RequestLogsControls';
import RequestLogsTable from './requestLogs/RequestLogsTable';
import ResponsePreviewModal from './requestLogs/ResponsePreviewModal';
import useAutoLoadOnReachBottom from './requestLogs/useAutoLoadOnReachBottom';
import useRequestLogServices from './requestLogs/useRequestLogServices';
import useRequestLogsFilters from './requestLogs/useRequestLogsFilters';
import useRequestLogsList from './requestLogs/useRequestLogsList';
import useResponsePreview from './requestLogs/useResponsePreview';

function RequestLogsContent({
  autoLoadRef,
  error,
  hasNextPage,
  loading,
  loadingMore,
  logs,
  onPreview,
  servicesById,
  totalCount,
  visibleCount,
}) {
  if (loading) return <div className="page-loader">Loading...</div>;
  if (error) return <div className="request-logs-error">{error}</div>;
  if (logs.length === 0) return <div className="request-logs-empty"><p>No request logs found for the current filter.</p></div>;

  return (
    <RequestLogsTable
      autoLoadRef={autoLoadRef}
      hasNextPage={hasNextPage}
      loadingMore={loadingMore}
      logs={logs}
      onPreview={onPreview}
      servicesById={servicesById}
      totalCount={totalCount}
      visibleCount={visibleCount}
    />
  );
}

export default function RequestLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const services = useRequestLogServices();
  const filters = useRequestLogsFilters(searchParams, setSearchParams);
  const listState = useRequestLogsList(filters.query);
  const preview = useResponsePreview();
  const autoLoadRef = useAutoLoadOnReachBottom({
    enabled: listState.hasNextPage,
    loading: listState.loading,
    loadingMore: listState.loadingMore,
    onReachBottom: listState.loadNextPage,
  });
  const servicesById = useMemo(
    () => Object.fromEntries(services.map((service) => [String(service.id), service.name])),
    [services],
  );

  return (
    <div className="page">
      <div className="page-header"><h1>Request Logs</h1><p className="page-desc">Retained request history with response previews, timings, status codes, and failure diagnostics.</p></div>
      <RequestLogsControls draft={filters.draft} onApply={filters.applyFilters} onClear={filters.clearFilters} onChange={filters.updateDraft} services={services} />
      <RequestLogsContent autoLoadRef={autoLoadRef} error={listState.error} hasNextPage={listState.hasNextPage} loading={listState.loading} loadingMore={listState.loadingMore} logs={listState.logs} onPreview={preview.openPreview} servicesById={servicesById} totalCount={listState.totalCount} visibleCount={listState.visibleCount} />
      {preview.previewLogId !== null && <ResponsePreviewModal detail={preview.previewDetail} error={preview.previewError} loading={preview.previewLoading} onClose={preview.closePreview} onViewerChange={preview.setViewerMode} viewerMode={preview.viewerMode} />}
    </div>
  );
}