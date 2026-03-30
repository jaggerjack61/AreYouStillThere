function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export default function HoverPreviewText({
  className = '',
  emptyValue = '—',
  panelClassName = '',
  text,
  truncateAt = 100,
}) {
  if (!text) return <span>{emptyValue}</span>;

  const normalizedText = String(text);
  const isTruncated = normalizedText.length > truncateAt;

  if (!isTruncated) {
    return <span className={className}>{normalizedText}</span>;
  }

  return (
    <span className={`hover-preview ${className}`.trim()}>
      <span
        className="hover-preview-trigger"
        aria-label={normalizedText}
        tabIndex={0}
      >
        {truncateText(normalizedText, truncateAt)}
      </span>
      <span className={`hover-preview-card ${panelClassName}`.trim()} role="tooltip">
        {normalizedText}
      </span>
    </span>
  );
}
