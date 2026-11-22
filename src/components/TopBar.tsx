import React from 'react';

export type WorkspaceTab = 'citizen' | 'triage';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onJumpToSection: (sectionId: string, tab?: WorkspaceTab) => void;
  onStartNewReport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onJumpToSection,
  onStartNewReport,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onJumpToSection('report-studio', 'citizen')}
          className="font-display cursor-pointer text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          Streetline
        </button>

        {/* Zone 2: 4 Concise Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => onJumpToSection('report-studio', 'citizen')}
            className={`cursor-pointer py-1 transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 hover:underline underline-offset-4 ${
              activeTab === 'citizen' ? 'text-slate-900 underline' : ''
            }`}
          >
            Report Issue
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('active-tickets', 'citizen')}
            className="cursor-pointer py-1 transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 hover:underline underline-offset-4"
          >
            Active Tickets
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('triage')}
            className={`cursor-pointer py-1 transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 hover:underline underline-offset-4 ${
              activeTab === 'triage' ? 'text-slate-900 underline' : ''
            }`}
          >
            Staff Triage
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('how-it-works', 'citizen')}
            className="cursor-pointer py-1 transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 hover:underline underline-offset-4"
          >
            How It Works
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onStartNewReport}
            className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            New Report
          </button>
        </div>
      </div>
    </header>
  );
};
