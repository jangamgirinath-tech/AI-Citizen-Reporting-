import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Languages,
  Loader2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  CivicTicket,
  IssueCategory,
  IssueSeverity,
  OfficialLanguage,
  TicketStatus,
  TicketsPayload,
} from '../types';
import {
  CATEGORY_LABELS,
  formatRelativeTime,
  OFFICIAL_LANGUAGES,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '../utils/civicHelpers';

interface StaffTriageConsoleProps {
  tickets: CivicTicket[];
  stats: TicketsPayload['stats'];
  onUpdateStatus: (
    ticketId: string,
    status: TicketStatus,
    note?: string
  ) => Promise<void>;
  onCorrectClassification: (
    ticketId: string,
    category: IssueCategory,
    severity: IssueSeverity,
    note: string
  ) => Promise<void>;
  onTranslateSummary: (
    ticketId: string,
    targetLanguage: OfficialLanguage
  ) => Promise<void>;
}

export const StaffTriageConsole: React.FC<StaffTriageConsoleProps> = ({
  tickets,
  stats,
  onUpdateStatus,
  onCorrectClassification,
  onTranslateSummary,
}) => {
  const [queueFilter, setQueueFilter] = useState<'all' | 'review'>('all');
  const [selectedId, setSelectedId] = useState<string>(tickets[0]?.id || '');

  const visibleTickets = useMemo(() => {
    if (queueFilter === 'review') {
      return tickets.filter(
        (t) => t.requiresHumanReview || t.status === 'needs_review' || t.status === 'reopened'
      );
    }
    return tickets;
  }, [tickets, queueFilter]);

  const selectedTicket =
    tickets.find((t) => t.id === selectedId) || visibleTickets[0] || tickets[0];

  const [editCategory, setEditCategory] = useState<IssueCategory>(
    selectedTicket?.category || 'pothole'
  );
  const [editSeverity, setEditSeverity] = useState<IssueSeverity>(
    selectedTicket?.severity || 'moderate'
  );
  const [correctionNote, setCorrectionNote] = useState('');
  const [targetLang, setTargetLang] = useState<OfficialLanguage>(
    selectedTicket?.officialLanguage || 'English'
  );
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTicket) {
      setEditCategory(selectedTicket.category);
      setEditSeverity(selectedTicket.severity);
      setTargetLang(selectedTicket.officialLanguage);
    }
  }, [selectedTicket?.id, selectedTicket?.category, selectedTicket?.severity, selectedTicket?.officialLanguage]);

  function selectRow(t: CivicTicket) {
    setSelectedId(t.id);
    setEditCategory(t.category);
    setEditSeverity(t.severity);
    setTargetLang(t.officialLanguage);
    setCorrectionNote('');
    setFeedbackMsg(null);
  }

  async function handleSaveCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket) return;
    setSavingCorrection(true);
    setFeedbackMsg(null);
    try {
      await onCorrectClassification(
        selectedTicket.id,
        editCategory,
        editSeverity,
        correctionNote
      );
      setCorrectionNote('');
      setFeedbackMsg(
        'Correction saved and queued into the monthly model retraining dataset.'
      );
    } finally {
      setSavingCorrection(false);
    }
  }

  async function handleStatusChange(nextStatus: TicketStatus) {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    setFeedbackMsg(null);
    try {
      await onUpdateStatus(selectedTicket.id, nextStatus);
      setFeedbackMsg(`Ticket status updated to ${STATUS_LABELS[nextStatus]}.`);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleTranslate(lang: OfficialLanguage) {
    if (!selectedTicket) return;
    setTargetLang(lang);
    setTranslating(true);
    setFeedbackMsg(null);
    try {
      await onTranslateSummary(selectedTicket.id, lang);
      setFeedbackMsg(`Official dispatch summary translated to ${lang}.`);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-blue-700">
            Municipal Operations & AI Feedback Loop
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Staff Triage & Human Review Queue
          </h1>
        </div>

        <div
          role="group"
          aria-label="Filter triage queue"
          className="inline-flex items-center rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            onClick={() => setQueueFilter('all')}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              queueFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Tickets ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter('review')}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              queueFilter === 'review'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Needs Review / Reopened ({stats.needsReviewCount})
          </button>
        </div>
      </div>

      {/* 4-column Triage Metric Strip */}
      <div className="mb-8 grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs text-slate-500">Open Work Orders</div>
          <div className="font-mono mt-1 text-xl font-semibold text-slate-900 tabular-nums">
            {stats.totalOpen}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Low-Confidence Queue</div>
          <div className="font-mono mt-1 text-xl font-semibold text-amber-800 tabular-nums">
            {stats.needsReviewCount}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Citizens Affected</div>
          <div className="font-mono mt-1 text-xl font-semibold text-slate-900 tabular-nums">
            {stats.totalAffectedVoices}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">AI Retraining Signals</div>
          <div className="font-mono mt-1 text-xl font-semibold text-blue-700 tabular-nums">
            {stats.retrainingSignalsCount}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: High-Density Triage Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Confidence</th>
                  <th className="px-4 py-3 text-right font-medium">Voices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTickets.map((t) => {
                  const active = selectedTicket?.id === t.id;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => selectRow(t)}
                      className={`h-11 cursor-pointer transition-colors ${
                        active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {t.id}
                        </div>
                        <div className="max-w-[200px] truncate text-[11px] text-slate-500">
                          {t.locationLabel}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                        {CATEGORY_LABELS[t.category]}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                        {STATUS_LABELS[t.status]}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                          t.confidenceScore < 75
                            ? 'font-semibold text-amber-800'
                            : 'text-slate-700'
                        }`}
                      >
                        {t.confidenceScore}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {t.affectedCount}
                      </td>
                    </tr>
                  );
                })}
                {visibleTickets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No tickets currently waiting in the human review queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Staff Inspection, Language Switch & Feedback Loop */}
        <div className="lg:col-span-5">
          {selectedTicket ? (
            <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                    {selectedTicket.id} · {formatRelativeTime(selectedTicket.updatedAt)}
                  </div>
                  <h2 className="font-display mt-1 text-lg font-bold text-slate-900">
                    {selectedTicket.title}
                  </h2>
                </div>
                {selectedTicket.requiresHumanReview && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 shrink-0">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Review Needed</span>
                  </span>
                )}
              </div>

              {feedbackMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span>{feedbackMsg}</span>
                </div>
              )}

              {selectedTicket.reviewReason && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{selectedTicket.reviewReason}</span>
                </div>
              )}

              {/* Official Language Switcher */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <Languages className="h-3.5 w-3.5" />
                    <span>Official Dispatch Summary</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {translating && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" />
                    )}
                    <select
                      value={targetLang}
                      disabled={translating}
                      onChange={(e) =>
                        handleTranslate(e.target.value as OfficialLanguage)
                      }
                      aria-label="Translate official dispatch summary"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                    >
                      {OFFICIAL_LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">
                  {selectedTicket.officialSummary}
                </p>
                {selectedTicket.originalTranscript && (
                  <div className="mt-2 text-xs text-slate-500">
                    Citizen input ({selectedTicket.detectedLanguage}): “
                    {selectedTicket.originalTranscript}”
                  </div>
                )}
              </div>

              {/* Dispatch Status Actions */}
              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 text-xs font-medium text-slate-700">
                  Update Dispatch State
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { status: 'ai_verified', label: 'Verify' },
                      { status: 'dispatched', label: 'Dispatch Crew' },
                      { status: 'resolved', label: 'Mark Resolved' },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.status}
                      type="button"
                      disabled={updatingStatus || selectedTicket.status === btn.status}
                      onClick={() => handleStatusChange(btn.status)}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
                        selectedTicket.status === btn.status
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff Correction -> AI Retraining Feedback Loop */}
              <form
                onSubmit={handleSaveCorrection}
                className="space-y-3 border-t border-slate-200 pt-4"
              >
                <div className="text-xs font-semibold text-slate-900">
                  Correct AI Classification (Retraining Feedback)
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as IssueCategory)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    {(Object.keys(CATEGORY_LABELS) as IssueCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editSeverity}
                    onChange={(e) => setEditSeverity(e.target.value as IssueSeverity)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    {(Object.keys(SEVERITY_LABELS) as IssueSeverity[]).map((sev) => (
                      <option key={sev} value={sev}>
                        Severity: {SEVERITY_LABELS[sev]}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Field calibration note (optional)..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {selectedTicket.aiCorrectionLog.length} logged corrections on ticket
                  </span>
                  <button
                    type="submit"
                    disabled={savingCorrection}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      {savingCorrection ? 'Saving...' : 'Verify & Log Training Signal'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
