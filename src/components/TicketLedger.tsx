import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  ImageIcon,
  MessageSquarePlus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type {
  CivicTicket,
  IssueCategory,
  TicketStatus,
  TicketsPayload,
} from '../types';
import {
  CATEGORY_LABELS,
  formatRelativeTime,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '../utils/civicHelpers';

interface TicketLedgerProps {
  tickets: CivicTicket[];
  stats: TicketsPayload['stats'];
  loading: boolean;
  onAddVoice: (ticketId: string) => Promise<void>;
  onReopenTicket: (ticketId: string) => Promise<void>;
}

type FilterTab = 'all' | 'needs_review' | 'dispatched' | 'resolved';

export const TicketLedger: React.FC<TicketLedgerProps> = ({
  tickets,
  stats,
  loading,
  onAddVoice,
  onReopenTicket,
}) => {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [inspectedTicket, setInspectedTicket] = useState<CivicTicket | null>(null);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filterTab === 'needs_review' && t.status !== 'needs_review' && !t.requiresHumanReview) {
        return false;
      }
      if (filterTab === 'dispatched' && t.status !== 'dispatched') return false;
      if (filterTab === 'resolved' && t.status !== 'resolved') return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.locationLabel.toLowerCase().includes(q) ||
        t.officialSummary.toLowerCase().includes(q)
      );
    });
  }, [tickets, filterTab, categoryFilter, searchQuery]);

  async function handleVoiceClick(ticketId: string) {
    setBusyTicketId(ticketId);
    try {
      await onAddVoice(ticketId);
    } finally {
      setBusyTicketId(null);
    }
  }

  async function handleReopenClick(ticketId: string) {
    setBusyTicketId(ticketId);
    try {
      await onReopenTicket(ticketId);
    } finally {
      setBusyTicketId(null);
    }
  }

  function renderStatusIcon(status: TicketStatus) {
    if (status === 'resolved') {
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />;
    }
    if (status === 'needs_review' || status === 'reopened') {
      return <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0" />;
    }
    return <Clock className="h-3.5 w-3.5 text-blue-700 shrink-0" />;
  }

  return (
    <section
      id="active-tickets"
      className="mx-auto max-w-6xl border-t border-slate-200 px-4 py-12 sm:px-6"
    >
      {/* 4-column Civic KPI Strip */}
      <div className="mb-10 grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Active Open Issues</div>
          <div className="font-mono mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {stats.totalOpen}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Clustered Citizen Voices
          </div>
          <div className="font-mono mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {stats.totalAffectedVoices}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Human Review Queue
          </div>
          <div className="font-mono mt-1.5 text-2xl font-semibold text-amber-800 tabular-nums">
            {stats.needsReviewCount}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Resolved & Verified
          </div>
          <div className="font-mono mt-1.5 text-2xl font-semibold text-emerald-800 tabular-nums">
            {stats.resolvedCount}
          </div>
        </div>
      </div>

      {/* Section Header & Interactive Filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Live Neighborhood Ticket Ledger
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Confirm existing hazards to boost dispatch priority, or reopen resolved
            tickets if a street repair failed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filter tickets by status"
            className="inline-flex items-center rounded-lg bg-slate-100 p-1"
          >
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'needs_review', label: 'Needs Review' },
                { key: 'dispatched', label: 'Dispatched' },
                { key: 'resolved', label: 'Resolved' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterTab(tab.key)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filterTab === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <option value="all">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as IssueCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search street or ID..."
              className="w-48 rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-blue-700"
            />
          </div>
        </div>
      </div>

      {/* Populated / Loading / Empty States */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <div className="text-sm font-semibold text-slate-900">
            No civic tickets match this filter
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Clear your search or switch status tabs to inspect active neighborhood issues.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterTab('all');
              setCategoryFilter('all');
              setSearchQuery('');
            }}
            className="mt-4 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => {
            const thumb = ticket.evidence[0]?.imageUrl;
            const isBusy = busyTicketId === ticket.id;
            return (
              <article
                key={ticket.id}
                className="grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-12"
              >
                {/* Thumbnail with resilient fallback */}
                <div className="sm:col-span-3">
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={ticket.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-[11px]">Audio-only report</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col justify-between gap-3 sm:col-span-9">
                  <div>
                    {/* Zero-pill unboxed metadata */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {ticket.id}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{CATEGORY_LABELS[ticket.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span>Severity: {SEVERITY_LABELS[ticket.severity]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {ticket.confidenceScore}% confidence
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {formatRelativeTime(ticket.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                        {renderStatusIcon(ticket.status)}
                        <span>{STATUS_LABELS[ticket.status]}</span>
                      </div>
                    </div>

                    <h3 className="font-display mt-1.5 text-lg font-semibold text-slate-900">
                      {ticket.title}
                    </h3>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                      <span>{ticket.locationLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {ticket.estimatedSizeOrFlow}
                      </span>
                      {ticket.privacyRedactedCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <EyeOff className="h-3 w-3" />
                            <span>
                              {ticket.privacyRedactedCount} privacy redactions
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
                      {ticket.officialSummary}
                    </p>
                  </div>

                  {/* Footer Actions & Affected Count */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono font-semibold text-blue-700 tabular-nums">
                        +{ticket.affectedCount}{' '}
                        {ticket.affectedCount === 1 ? 'person' : 'people'} affected
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        |
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {ticket.evidence.length}{' '}
                        {ticket.evidence.length === 1 ? 'photo/note' : 'photos/notes'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectedTicket(ticket)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect Ticket</span>
                      </button>

                      {ticket.status === 'resolved' ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleReopenClick(ticket.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{isBusy ? 'Reopening...' : 'Reopen Issue'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleVoiceClick(ticket.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          <span>{isBusy ? 'Adding...' : 'Add Your Voice (+1)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Inspection Modal */}
      {inspectedTicket && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ticket ${inspectedTicket.id} details`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setInspectedTicket(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                  {inspectedTicket.id} · {CATEGORY_LABELS[inspectedTicket.category]}
                </div>
                <h3 className="font-display mt-1 text-xl font-bold text-slate-900">
                  {inspectedTicket.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTicket(null)}
                aria-label="Close ticket details"
                className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Official Dispatch Summary ({inspectedTicket.officialLanguage})
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">
                  {inspectedTicket.officialSummary}
                </p>
              </div>

              {inspectedTicket.originalTranscript && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="text-xs font-medium text-slate-500">
                    Original Citizen Voice Note ({inspectedTicket.detectedLanguage})
                  </div>
                  <p className="mt-1 text-sm italic text-slate-700">
                    “{inspectedTicket.originalTranscript}”
                  </p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 text-xs font-medium text-slate-500">
                  Attached Evidence ({inspectedTicket.evidence.length})
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {inspectedTicket.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                    >
                      {ev.imageUrl ? (
                        <img
                          src={ev.imageUrl}
                          alt="Citizen submitted street evidence"
                          referrerPolicy="no-referrer"
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center text-xs text-slate-400">
                          Voice confirmation
                        </div>
                      )}
                      <div className="px-2 py-1.5 text-[11px] text-slate-600 tabular-nums">
                        {formatRelativeTime(ev.submittedAt)} · Trust: {ev.reporterTrustTier}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 text-xs font-medium text-slate-500">
                  Status & Audit Timeline
                </div>
                <div className="space-y-3">
                  {inspectedTicket.timeline.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-4 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          {entry.actor}
                        </span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="text-slate-700">{entry.message}</span>
                      </div>
                      <span className="font-mono text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
