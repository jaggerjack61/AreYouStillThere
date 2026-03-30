import { useId } from 'react';

import {
  RESULT_FILTER_OPTIONS,
  SORT_DIRECTION_OPTIONS,
  SORT_FIELD_OPTIONS,
} from './constants';

function SelectField({ children, label, value, onChange }) {
  const selectId = useId();

  return (
    <label className="form-field filter-field request-logs-field" htmlFor={selectId}>
      <span>{label}</span>
      <select id={selectId} aria-label={label} value={value} onChange={onChange}>
        {children}
      </select>
    </label>
  );
}

function SearchField({ value, onChange }) {
  return (
    <label className="form-field filter-field request-logs-field request-logs-search-field">
      <span>Search</span>
      <input
        aria-label="Search"
        type="search"
        value={value}
        onChange={onChange}
        placeholder="Search previews, errors, reasons, or services"
      />
    </label>
  );
}

export default function RequestLogsControls({
  draft,
  onApply,
  onClear,
  onChange,
  services,
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    onApply();
  };

  return (
    <form className="request-logs-toolbar" onSubmit={handleSubmit}>
      <div className="request-logs-toolbar-intro">
        <p className="request-logs-toolbar-kicker">Request Log Navigator</p>
        <p className="request-logs-toolbar-blurb">Filter failures fast, search through payload clues, and let the next 50 rows load themselves as you move down the stream.</p>
      </div>
      <div className="request-logs-toolbar-grid">
        <SelectField label="Service" value={draft.service} onChange={(event) => onChange('service', event.target.value)}>
          <option value="">All Services</option>
          {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
        </SelectField>
        <SelectField label="Result" value={draft.result} onChange={(event) => onChange('result', event.target.value)}>
          {RESULT_FILTER_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SearchField value={draft.search} onChange={(event) => onChange('search', event.target.value)} />
        <SelectField label="Sort column" value={draft.sortField} onChange={(event) => onChange('sortField', event.target.value)}>
          {SORT_FIELD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField label="Sort direction" value={draft.sortDirection} onChange={(event) => onChange('sortDirection', event.target.value)}>
          {SORT_DIRECTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
      </div>
      <div className="request-logs-toolbar-actions">
        <button type="button" className="btn btn-secondary" onClick={onClear}>Clear</button>
        <button type="submit" className="btn btn-primary">Apply filters</button>
      </div>
    </form>
  );
}