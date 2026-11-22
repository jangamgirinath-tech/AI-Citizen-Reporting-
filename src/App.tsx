import { useCallback, useEffect, useState } from 'react';
import { ArchitectureSection } from './components/ArchitectureSection';
import { ReportStudio } from './components/ReportStudio';
import { StaffTriageConsole } from './components/StaffTriageConsole';
import { TicketLedger } from './components/TicketLedger';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import type {
  CivicTicket,
  IssueCategory,
  IssueSeverity,
  OfficialLanguage,
  TicketStatus,
  TicketsPayload,
} from './types';

const DEFAULT_STATS: TicketsPayload['stats'] = {
  totalOpen: 0,
  totalAffectedVoices: 0,
  needsReviewCount: 0,
  resolvedCount: 0,
  retrainingSignalsCount: 0,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('citizen');
  const [officialLanguage, setOfficialLanguage] =
    useState<OfficialLanguage>('English');
  const [tickets, setTickets] = useState<CivicTicket[]>([]);
  const [stats, setStats] = useState<TicketsPayload['stats']>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const fetchTickets = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load civic tickets.');
      }
      setTickets(data.tickets || []);
      setStats(data.stats || DEFAULT_STATS);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to reach Streetline server.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  function handleJumpToSection(sectionId: string, tab: WorkspaceTab = 'citizen') {
    setActiveTab(tab);
    window.setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  }

  function handleStartNewReport() {
    setResetSignal((n) => n + 1);
    handleJumpToSection('report-studio', 'citizen');
  }

  function handleTicketCreatedOrMerged(
    updatedTicket: CivicTicket,
    mode: 'created' | 'merged'
  ) {
    setTickets((prev) => {
      const exists = prev.some((t) => t.id === updatedTicket.id);
      if (exists || mode === 'merged') {
        return prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t));
      }
      return [updatedTicket, ...prev];
    });
    fetchTickets();
  }

  async function handleAddVoice(ticketId: string) {
    const res = await fetch(`/api/tickets/${ticketId}/add-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add voice.');
    setTickets((prev) =>
      prev.map((t) => (t.id === data.ticket.id ? data.ticket : t))
    );
    setStats(data.stats);
  }

  async function handleReopenTicket(ticketId: string) {
    const res = await fetch(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'reopened',
        actor: 'Citizen Feedback',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reopen ticket.');
    setTickets((prev) =>
      prev.map((t) => (t.id === data.ticket.id ? data.ticket : t))
    );
    setStats(data.stats);
  }

  async function handleUpdateStatus(
    ticketId: string,
    status: TicketStatus,
    note?: string
  ) {
    const res = await fetch(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status.');
    setTickets((prev) =>
      prev.map((t) => (t.id === data.ticket.id ? data.ticket : t))
    );
    setStats(data.stats);
  }

  async function handleCorrectClassification(
    ticketId: string,
    category: IssueCategory,
    severity: IssueSeverity,
    note: string
  ) {
    const res = await fetch(`/api/tickets/${ticketId}/correct`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, severity, note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save correction.');
    setTickets((prev) =>
      prev.map((t) => (t.id === data.ticket.id ? data.ticket : t))
    );
    setStats(data.stats);
  }

  async function handleTranslateSummary(
    ticketId: string,
    targetLanguage: OfficialLanguage
  ) {
    const res = await fetch('/api/translate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, targetLanguage }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Translation failed.');
    setTickets((prev) =>
      prev.map((t) => (t.id === data.ticket.id ? data.ticket : t))
    );
    setStats(data.stats);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onJumpToSection={handleJumpToSection}
        onStartNewReport={handleStartNewReport}
      />

      {/* Compact mobile view switch */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <div className="inline-flex w-full rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('citizen')}
            className={`flex-1 cursor-pointer rounded-md py-1.5 text-xs font-medium ${
              activeTab === 'citizen'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Citizen Reporting
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('triage')}
            className={`flex-1 cursor-pointer rounded-md py-1.5 text-xs font-medium ${
              activeTab === 'triage'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Staff Triage
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'citizen' ? (
          <>
            <ReportStudio
              officialLanguage={officialLanguage}
              onChangeOfficialLanguage={setOfficialLanguage}
              onTicketCreatedOrMerged={handleTicketCreatedOrMerged}
              resetSignal={resetSignal}
            />
            <TicketLedger
              tickets={tickets}
              stats={stats}
              loading={loading}
              onAddVoice={handleAddVoice}
              onReopenTicket={handleReopenTicket}
            />
            <ArchitectureSection />
          </>
        ) : (
          <StaffTriageConsole
            tickets={tickets}
            stats={stats}
            onUpdateStatus={handleUpdateStatus}
            onCorrectClassification={handleCorrectClassification}
            onTranslateSummary={handleTranslateSummary}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <span>Streetline Municipal Reporting Platform</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => handleJumpToSection('report-studio', 'citizen')}
              className="cursor-pointer hover:text-slate-900"
            >
              Citizen Intake
            </button>
            <button
              type="button"
              onClick={() => handleJumpToSection('active-tickets', 'citizen')}
              className="cursor-pointer hover:text-slate-900"
            >
              Public Ledger
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('triage');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="cursor-pointer hover:text-slate-900"
            >
              Operations Triage
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
