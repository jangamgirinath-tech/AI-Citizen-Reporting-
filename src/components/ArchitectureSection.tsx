import React from 'react';

export const ArchitectureSection: React.FC = () => {
  const pillars = [
    {
      index: '01.',
      title: 'Capture Quality & Authenticity Gate',
      summary:
        'At submission, Streetline checks focus sharpness, lighting exposure, framing distance, and capture timestamps to block screenshots or stale photos before they reach municipal queues.',
    },
    {
      index: '02.',
      title: 'Multilingual Speech-to-Dispatch',
      summary:
        'Citizens speak in their own dialect. Speech transcription captures the note verbatim, extracts street landmarks and duration, and translates an actionable brief into the city official language.',
    },
    {
      index: '03.',
      title: 'Three-Signal Duplicate Clustering',
      summary:
        'GPS proximity within 50 m, visual issue matching, and multimodal embeddings combine so repeated neighborhood reports add fresh photo evidence and increment people affected instead of flooding dispatch.',
    },
    {
      index: '04.',
      title: 'Privacy Shield & Continuous Retraining',
      summary:
        'Faces and license plates are blurred prior to public display. Low-confidence tickets route to human reviewers, and every staff correction or citizen reopen logs a training signal.',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-6xl border-t border-slate-200 px-4 py-14 sm:px-6"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-medium text-blue-700">Platform Architecture</p>
        <h2 className="font-display mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
          Built for low-friction reporting and accountable public works
        </h2>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 border-t border-slate-200 pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((item) => (
          <div key={item.index} className="space-y-2">
            <div className="font-mono text-xs font-semibold text-slate-400 tabular-nums">
              {item.index}
            </div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {item.title}
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">{item.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
