import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Droplets,
  EyeOff,
  FileWarning,
  Footprints,
  Lightbulb,
  Loader2,
  MapPin,
  Mic,
  RefreshCw,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  Volume2,
  WifiOff,
} from 'lucide-react';
import type {
  AnalysisResponse,
  CivicTicket,
  IssueCategory,
  OfficialLanguage,
  ReporterTrustTier,
} from '../types';
import {
  applyPrivacyRedactionToDataUrl,
  CATEGORY_LABELS,
  fileToBase64,
  imageUrlToBase64,
  LOCATION_PRESETS,
  OFFICIAL_LANGUAGES,
  SAMPLE_CAPTURES,
  SEVERITY_LABELS,
  speakPrompt,
  STATUS_LABELS,
} from '../utils/civicHelpers';

interface OfflineQueuedReport {
  id: string;
  createdAt: string;
  imageBase64?: string;
  imageMimeType?: string;
  presetImageUrl?: string;
  voiceText?: string;
  locationLabel: string;
  lat: number;
  lng: number;
  officialLanguage: OfficialLanguage;
  categoryHint?: IssueCategory;
}

const OFFLINE_QUEUE_KEY = 'streetline_offline_queue_v1';

interface ReportStudioProps {
  officialLanguage: OfficialLanguage;
  onChangeOfficialLanguage: (lang: OfficialLanguage) => void;
  onTicketCreatedOrMerged: (ticket: CivicTicket, mode: 'created' | 'merged') => void;
  resetSignal: number;
}

export const ReportStudio: React.FC<ReportStudioProps> = ({
  officialLanguage,
  onChangeOfficialLanguage,
  onTicketCreatedOrMerged,
  resetSignal,
}) => {
  const [studioMode, setStudioMode] = useState<'standard' | 'accessible'>('standard');
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const isOffline = simulateOffline || !browserOnline;

  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedReport[]>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [syncingOffline, setSyncingOffline] = useState(false);

  // Capture inputs
  const [rawImageBase64, setRawImageBase64] = useState<string | undefined>();
  const [rawImageMime, setRawImageMime] = useState<string>('image/jpeg');
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [redactedImageBase64, setRedactedImageBase64] = useState<string | undefined>();
  const [presetImageUrl, setPresetImageUrl] = useState<string | undefined>();
  const [exifTimestamp, setExifTimestamp] = useState<string | undefined>();

  // Audio / voice note inputs
  const [voiceText, setVoiceText] = useState<string>('');
  const [audioBase64, setAudioBase64] = useState<string | undefined>();
  const [audioMimeType, setAudioMimeType] = useState<string | undefined>();
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Location & Trust
  const [selectedLocId, setSelectedLocId] = useState<string>(LOCATION_PRESETS[0].id);
  const [customGps, setCustomGps] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [accessibleCategoryHint, setAccessibleCategoryHint] = useState<
    IssueCategory | undefined
  >();

  // Analysis & submission state
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [overrideTitle, setOverrideTitle] = useState('');
  const [overrideCategory, setOverrideCategory] = useState<IssueCategory>('pothole');
  const [issuedTicket, setIssuedTicket] = useState<{
    ticket: CivicTicket;
    mode: 'created' | 'merged';
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    } catch {
      // Ignore storage quota issues
    }
  }, [offlineQueue]);

  useEffect(() => {
    if (resetSignal > 0) {
      handleReset();
    }
  }, [resetSignal]);

  const activeLocation = customGps || {
    lat: LOCATION_PRESETS.find((l) => l.id === selectedLocId)?.lat ?? 37.7749,
    lng: LOCATION_PRESETS.find((l) => l.id === selectedLocId)?.lng ?? -122.4194,
    label:
      LOCATION_PRESETS.find((l) => l.id === selectedLocId)?.label ??
      'Oakwood Elementary North Gate',
  };

  function handleReset() {
    setRawImageBase64(undefined);
    setPreviewImageUrl('');
    setRedactedImageBase64(undefined);
    setPresetImageUrl(undefined);
    setExifTimestamp(undefined);
    setVoiceText('');
    setAudioBase64(undefined);
    setAudioMimeType(undefined);
    setAudioPreviewUrl('');
    setAnalysis(null);
    setErrorMessage(null);
    setIssuedTicket(null);
    setEditDetailsOpen(false);
    setAccessibleCategoryHint(undefined);
  }

  async function runAiAnalysis(params: {
    imgBase64?: string;
    imgMime?: string;
    audBase64?: string;
    audMime?: string;
    noteText?: string;
    loc?: { lat: number; lng: number; label: string };
    exifIso?: string;
    presetUrl?: string;
  }) {
    if (isOffline) {
      const queued: OfflineQueuedReport = {
        id: `OFF-${Date.now().toString().slice(-4)}`,
        createdAt: new Date().toISOString(),
        imageBase64: params.imgBase64,
        imageMimeType: params.imgMime,
        presetImageUrl: params.presetUrl,
        voiceText: params.noteText,
        locationLabel: (params.loc || activeLocation).label,
        lat: (params.loc || activeLocation).lat,
        lng: (params.loc || activeLocation).lng,
        officialLanguage,
        categoryHint: accessibleCategoryHint,
      };
      setOfflineQueue((prev) => [queued, ...prev]);
      setErrorMessage(null);
      if (studioMode === 'accessible') {
        speakPrompt('You are offline. Your report is saved safely and will upload when connected.');
      }
      return;
    }

    setAnalyzing(true);
    setErrorMessage(null);
    setIssuedTicket(null);

    try {
      const loc = params.loc || activeLocation;
      const response = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: params.imgBase64,
          imageMimeType: params.imgMime,
          audioBase64: params.audBase64,
          audioMimeType: params.audMime,
          voiceText: params.noteText,
          lat: loc.lat,
          lng: loc.lng,
          locationLabel: loc.label,
          exifTimestamp: params.exifIso,
          officialLanguage,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI analysis failed.');
      }

      const result = data as AnalysisResponse;

      if (params.imgBase64) {
        const redacted = await applyPrivacyRedactionToDataUrl(
          params.imgBase64,
          result.privacyBoxes || []
        );
        setRedactedImageBase64(redacted);
        setPreviewImageUrl(redacted);
      }

      setAnalysis(result);
      setOverrideTitle(result.title);
      setOverrideCategory(result.category);

      if (studioMode === 'accessible') {
        if (!result.qualityCheck.passed) {
          speakPrompt(result.qualityCheck.guidanceMessage);
        } else if (result.duplicateMatch) {
          speakPrompt(
            `This issue is already reported nearby by ${result.duplicateMatch.affectedCount} people. Tap Add Your Voice to confirm it.`
          );
        } else {
          speakPrompt(
            `Detected ${CATEGORY_LABELS[result.category]}. Tap Submit Report to send.`
          );
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to analyze capture.'
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);

    const { base64, mimeType } = await fileToBase64(file);
    const captureIso = file.lastModified
      ? new Date(file.lastModified).toISOString()
      : new Date().toISOString();

    setRawImageBase64(base64);
    setRawImageMime(mimeType);
    setPreviewImageUrl(base64);
    setPresetImageUrl(undefined);
    setExifTimestamp(captureIso);

    await runAiAnalysis({
      imgBase64: base64,
      imgMime: mimeType,
      audBase64: audioBase64,
      audMime: audioMimeType,
      noteText: voiceText,
      exifIso: captureIso,
    });
  }

  async function handlePickSample(sampleId: string) {
    const sample = SAMPLE_CAPTURES.find((s) => s.id === sampleId);
    if (!sample) return;

    setErrorMessage(null);
    setSelectedLocId(sample.defaultLocationId);
    setCustomGps(null);
    const locObj =
      LOCATION_PRESETS.find((l) => l.id === sample.defaultLocationId) ||
      LOCATION_PRESETS[0];

    setVoiceText(sample.sampleVoiceText);
    setAudioBase64(undefined);
    setAudioMimeType(undefined);
    setAudioPreviewUrl('');
    setPresetImageUrl(sample.imageUrl);
    setPreviewImageUrl(sample.imageUrl);

    try {
      const { base64, mimeType } = await imageUrlToBase64(sample.imageUrl);
      const nowIso = new Date().toISOString();
      setRawImageBase64(base64);
      setRawImageMime(mimeType);
      setExifTimestamp(nowIso);

      await runAiAnalysis({
        imgBase64: base64,
        imgMime: mimeType,
        noteText: sample.sampleVoiceText,
        loc: { lat: locObj.lat, lng: locObj.lng, label: locObj.label },
        exifIso: nowIso,
        presetUrl: sample.imageUrl,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to load sample capture.'
      );
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) mediaChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(mediaChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const { base64, mimeType } = await fileToBase64(blob);
        setAudioBase64(base64);
        setAudioMimeType(mimeType);
        setAudioPreviewUrl(URL.createObjectURL(blob));

        if (rawImageBase64 || voiceText.trim() || blob.size > 0) {
          await runAiAnalysis({
            imgBase64: rawImageBase64,
            imgMime: rawImageMime,
            audBase64: base64,
            audMime: mimeType,
            noteText: voiceText,
            exifIso: exifTimestamp,
            presetUrl: presetImageUrl,
          });
        }
      };

      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsRecording(true);
      recorder.start();
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setErrorMessage(
        'Microphone permission is blocked or unavailable. You can type or choose a sample voice note below.'
      );
    }
  }

  function handleUseMyGps() {
    if (!('geolocation' in navigator)) {
      setErrorMessage('Geolocation is not supported in this browser.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomGps({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          label: `GPS Pin (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
        });
        setLocatingGps(false);
      },
      () => {
        setLocatingGps(false);
        setErrorMessage(
          'Location access denied. Choose a neighborhood street block instead.'
        );
      },
      { timeout: 8000 }
    );
  }

  async function handleSubmitTicket() {
    if (!analysis || !analysis.qualityCheck.passed) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: overrideTitle.trim() || analysis.title,
          category: overrideCategory || analysis.category,
          severity: analysis.severity,
          estimatedSizeOrFlow: analysis.estimatedSizeOrFlow,
          confidenceScore: analysis.confidenceScore,
          requiresHumanReview: analysis.requiresHumanReview,
          reviewReason: analysis.reviewReason,
          locationLabel: activeLocation.label,
          lat: activeLocation.lat,
          lng: activeLocation.lng,
          officialLanguage: analysis.officialLanguage,
          officialSummary: analysis.officialSummary,
          extractedDetails: analysis.extractedDetails,
          originalTranscript: analysis.originalTranscript,
          detectedLanguage: analysis.detectedLanguage,
          privacyRedactedCount: analysis.privacyBoxes.length,
          redactedImageBase64: presetImageUrl ? undefined : redactedImageBase64,
          imageMimeType: 'image/jpeg',
          presetImageUrl,
          reporterTrustTier: 'trusted' as ReporterTrustTier,
          embeddingVector: analysis.embeddingVector,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not issue ticket.');
      }

      setIssuedTicket({ ticket: data.ticket, mode: 'created' });
      onTicketCreatedOrMerged(data.ticket, 'created');
      if (studioMode === 'accessible') {
        speakPrompt(`Ticket ${data.ticket.id} created and sent to city crews.`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddVoiceToDuplicate() {
    if (!analysis?.duplicateMatch) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/tickets/${analysis.duplicateMatch.ticketId}/add-voice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            redactedImageBase64: presetImageUrl ? undefined : redactedImageBase64,
            imageMimeType: 'image/jpeg',
            presetImageUrl,
            originalTranscript: analysis.originalTranscript,
            detectedLanguage: analysis.detectedLanguage,
            additionalPrivacyCount: analysis.privacyBoxes.length,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not merge duplicate report.');
      }

      setIssuedTicket({ ticket: data.ticket, mode: 'merged' });
      onTicketCreatedOrMerged(data.ticket, 'merged');
      if (studioMode === 'accessible') {
        speakPrompt(
          `Your voice was added to ticket ${data.ticket.id}. Now ${data.ticket.affectedCount} people affected.`
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Merge failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSyncOfflineQueue() {
    if (isOffline || offlineQueue.length === 0) return;
    setSyncingOffline(true);
    setErrorMessage(null);

    try {
      const remaining: OfflineQueuedReport[] = [];
      for (const item of offlineQueue) {
        try {
          const analyzeRes = await fetch('/api/analyze-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: item.imageBase64,
              imageMimeType: item.imageMimeType,
              voiceText:
                item.voiceText ||
                (item.categoryHint
                  ? `Offline citizen report: ${CATEGORY_LABELS[item.categoryHint]}`
                  : undefined),
              lat: item.lat,
              lng: item.lng,
              locationLabel: item.locationLabel,
              officialLanguage: item.officialLanguage,
            }),
          });
          if (!analyzeRes.ok) {
            remaining.push(item);
            continue;
          }
          const analyzed = (await analyzeRes.json()) as AnalysisResponse;

          if (analyzed.duplicateMatch) {
            const mergeRes = await fetch(
              `/api/tickets/${analyzed.duplicateMatch.ticketId}/add-voice`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  redactedImageBase64: item.presetImageUrl ? undefined : item.imageBase64,
                  imageMimeType: item.imageMimeType || 'image/jpeg',
                  presetImageUrl: item.presetImageUrl,
                  originalTranscript: analyzed.originalTranscript,
                  detectedLanguage: analyzed.detectedLanguage,
                }),
              }
            );
            if (mergeRes.ok) {
              const merged = await mergeRes.json();
              onTicketCreatedOrMerged(merged.ticket, 'merged');
            }
          } else {
            const createRes = await fetch('/api/tickets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: analyzed.title,
                category: analyzed.category,
                severity: analyzed.severity,
                estimatedSizeOrFlow: analyzed.estimatedSizeOrFlow,
                confidenceScore: analyzed.confidenceScore,
                requiresHumanReview: analyzed.requiresHumanReview,
                reviewReason: analyzed.reviewReason,
                locationLabel: item.locationLabel,
                lat: item.lat,
                lng: item.lng,
                officialLanguage: analyzed.officialLanguage,
                officialSummary: analyzed.officialSummary,
                extractedDetails: analyzed.extractedDetails,
                originalTranscript: analyzed.originalTranscript,
                detectedLanguage: analyzed.detectedLanguage,
                privacyRedactedCount: analyzed.privacyBoxes.length,
                redactedImageBase64: item.presetImageUrl ? undefined : item.imageBase64,
                imageMimeType: item.imageMimeType || 'image/jpeg',
                presetImageUrl: item.presetImageUrl,
                embeddingVector: analyzed.embeddingVector,
              }),
            });
            if (createRes.ok) {
              const created = await createRes.json();
              onTicketCreatedOrMerged(created.ticket, 'created');
            }
          }
        } catch {
          remaining.push(item);
        }
      }
      setOfflineQueue(remaining);
    } finally {
      setSyncingOffline(false);
    }
  }

  const accessibleCategories: Array<{
    id: IssueCategory;
    label: string;
    prompt: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'pothole',
      label: 'Road Hole',
      prompt: 'Road pothole selected. Tap camera to take a photo, or hold microphone to speak.',
      icon: <AlertTriangle className="h-7 w-7" />,
    },
    {
      id: 'sewage_overflow',
      label: 'Drain / Sewage',
      prompt: 'Drain overflow selected. Take a photo of the blocked drain.',
      icon: <Droplets className="h-7 w-7" />,
    },
    {
      id: 'garbage',
      label: 'Trash Pile',
      prompt: 'Garbage pile selected. Take a photo of the waste.',
      icon: <Trash2 className="h-7 w-7" />,
    },
    {
      id: 'water_leak',
      label: 'Water Leak',
      prompt: 'Water leak selected. Take a photo of the leaking pipe or valve.',
      icon: <Droplets className="h-7 w-7" />,
    },
    {
      id: 'streetlight',
      label: 'Broken Light',
      prompt: 'Broken streetlight selected. Take a photo or speak the street name.',
      icon: <Lightbulb className="h-7 w-7" />,
    },
    {
      id: 'sidewalk_hazard',
      label: 'Sidewalk Damage',
      prompt: 'Sidewalk hazard selected. Take a photo of the broken pavement.',
      icon: <Footprints className="h-7 w-7" />,
    },
  ];

  return (
    <section
      id="report-studio"
      className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12"
    >
      {/* Workspace Utility Bar (Language, Accessible Mode, Offline Sync) */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Reporting interface mode"
            className="inline-flex items-center rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              onClick={() => setStudioMode('standard')}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                studioMode === 'standard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard Studio
            </button>
            <button
              type="button"
              onClick={() => {
                setStudioMode('accessible');
                speakPrompt(
                  'Icon and voice mode enabled. Tap an issue icon, take a photo, or speak.'
                );
              }}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                studioMode === 'accessible'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Icon & Voice Mode
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="whitespace-nowrap">Official summary language</span>
            <select
              value={officialLanguage}
              onChange={(e) =>
                onChangeOfficialLanguage(e.target.value as OfficialLanguage)
              }
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              {OFFICIAL_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3">
          {offlineQueue.length > 0 && (
            <button
              type="button"
              disabled={isOffline || syncingOffline}
              onClick={handleSyncOfflineQueue}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncingOffline ? 'animate-spin' : ''}`}
              />
              <span>
                {syncingOffline
                  ? 'Syncing...'
                  : `Sync ${offlineQueue.length} Offline ${offlineQueue.length === 1 ? 'Report' : 'Reports'}`}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSimulateOffline((v) => !v)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isOffline
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" />
            <span>{isOffline ? 'Offline Mode Active' : 'Simulate Offline'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Hero + Interactive Reporting Anchor */}
      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left Column: Editorial Overview & Mechanisms (42% / 5 cols) */}
        <div className="flex flex-col justify-between lg:col-span-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-blue-700">
              Zero-Form Civic Intake
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl lg:text-[2.6rem] lg:leading-[1.12]">
              Snap, speak, send. We fill out the rest.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              Upload a street photo or speak in any language. Streetline verifies photo
              clarity, blurs faces and license plates, merges nearby duplicate reports,
              and dispatches an official summary to city crews.
            </p>
          </div>

          <div className="mt-8 divide-y divide-slate-200 border-t border-b border-slate-200">
            <div className="py-4">
              <div className="font-display text-sm font-semibold text-slate-900">
                01. Quality & Privacy Gate at Capture
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Flags blurry, dark, or stock screenshots before upload and automatically
                redacts visible faces and vehicle plates.
              </p>
            </div>
            <div className="py-4">
              <div className="font-display text-sm font-semibold text-slate-900">
                02. Any-Language Voice Extraction
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Transcribes local speech, pulls landmark and duration clues, and
                translates summaries into {officialLanguage} for public works.
              </p>
            </div>
            <div className="py-4">
              <div className="font-display text-sm font-semibold text-slate-900">
                03. Three-Signal Duplicate Clustering
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Combines 50 m GPS radius, visual similarity, and multimodal embeddings so
                neighbors unite behind one active ticket.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Dominant Interactive Reporting Card (58% / 7 cols) */}
        <div className="lg:col-span-7">
          <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
            {issuedTicket ? (
              /* Confirmation State */
              <div className="flex flex-1 flex-col justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-semibold">
                      {issuedTicket.mode === 'merged'
                        ? 'Your voice and photo were added to an active neighborhood ticket'
                        : 'Ticket issued and routed to municipal operations'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-4">
                    <div>
                      <span className="font-mono text-sm font-semibold text-blue-700 tabular-nums">
                        {issuedTicket.ticket.id}
                      </span>
                      <h2 className="font-display mt-1 text-2xl font-bold text-slate-900">
                        {issuedTicket.ticket.title}
                      </h2>
                    </div>
                    <div className="font-mono text-sm font-medium text-slate-700 tabular-nums">
                      {issuedTicket.ticket.affectedCount}{' '}
                      {issuedTicket.ticket.affectedCount === 1 ? 'citizen' : 'citizens'}{' '}
                      affected
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{CATEGORY_LABELS[issuedTicket.ticket.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span>Severity: {SEVERITY_LABELS[issuedTicket.ticket.severity]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {issuedTicket.ticket.confidenceScore}% AI confidence
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{issuedTicket.ticket.locationLabel}</span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-700">
                    {issuedTicket.ticket.officialSummary}
                  </p>

                  {/* Readable 4-step status progress */}
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <div className="text-xs font-medium text-slate-500">
                      Current Ticket Progress
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {(
                        [
                          { key: 'submitted', label: 'Submitted' },
                          {
                            key: 'ai_verified',
                            label: issuedTicket.ticket.requiresHumanReview
                              ? 'Human Review'
                              : 'AI Verified',
                          },
                          { key: 'dispatched', label: 'Dispatched' },
                          { key: 'resolved', label: 'Resolved' },
                        ] as const
                      ).map((step, idx) => {
                        const orderMap: Record<string, number> = {
                          submitted: 0,
                          ai_verified: 1,
                          needs_review: 1,
                          dispatched: 2,
                          resolved: 3,
                          reopened: 1,
                        };
                        const activeIdx = orderMap[issuedTicket.ticket.status] ?? 0;
                        const reached = idx <= activeIdx;
                        return (
                          <div key={step.key} className="space-y-1.5">
                            <div
                              className={`h-1.5 w-full rounded-full ${
                                reached ? 'bg-blue-700' : 'bg-slate-200'
                              }`}
                            />
                            <div
                              className={`text-xs ${
                                reached ? 'font-medium text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              {step.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <span className="text-xs text-slate-500">
                    Status: {STATUS_LABELS[issuedTicket.ticket.status]}
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    Report Another Issue
                  </button>
                </div>
              </div>
            ) : (
              /* Active Capture & AI Analysis Flow */
              <div className="space-y-5">
                {errorMessage && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
                  >
                    <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {isOffline && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                    <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>
                      Offline mode active. Captures will save locally to your device and
                      run full AI verification when reconnected.
                    </span>
                  </div>
                )}

                {studioMode === 'accessible' && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        1. Tap what you see
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          speakPrompt(
                            'Tap an icon that matches the street issue, then take a photo or hold the microphone button to speak.'
                          )
                        }
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>Read instructions</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {accessibleCategories.map((cat) => {
                        const selected = accessibleCategoryHint === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setAccessibleCategoryHint(cat.id);
                              speakPrompt(cat.prompt);
                            }}
                            className={`flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-colors ${
                              selected
                                ? 'border-blue-700 bg-blue-50 text-blue-900'
                                : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {cat.icon}
                            <span className="text-xs font-semibold">{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Photo Capture + Quick Sample Strip */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {studioMode === 'accessible'
                        ? '2. Take or upload a photo'
                        : 'Street Photo & Voice Note'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>Snap / Upload Photo</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelected}
                        className="sr-only"
                      />
                    </div>
                  </div>

                  {/* Sample quick-test photos */}
                  <div className="mt-3">
                    <div className="mb-1.5 text-xs text-slate-500">
                      Or test immediately with a field capture:
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SAMPLE_CAPTURES.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          disabled={analyzing}
                          onClick={() => handlePickSample(sample.id)}
                          className={`group cursor-pointer overflow-hidden rounded-lg border text-left transition-colors disabled:opacity-60 ${
                            presetImageUrl === sample.imageUrl
                              ? 'border-blue-700 bg-blue-50/40'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                            <img
                              src={sample.imageUrl}
                              alt={sample.label}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                          </div>
                          <div className="truncate px-2 py-1.5 text-[11px] font-medium text-slate-700">
                            {sample.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Location & Voice Input Row */}
                <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Location Pin
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={customGps ? '__custom__' : selectedLocId}
                        onChange={(e) => {
                          setCustomGps(null);
                          setSelectedLocId(e.target.value);
                        }}
                        className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        {customGps && (
                          <option value="__custom__">{customGps.label}</option>
                        )}
                        {LOCATION_PRESETS.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleUseMyGps}
                        disabled={locatingGps}
                        title="Use device GPS"
                        className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 transition-colors hover:bg-slate-100 shrink-0"
                      >
                        {locatingGps ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MapPin className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {customGps
                        ? 'Live device GPS coordinates attached'
                        : LOCATION_PRESETS.find((l) => l.id === selectedLocId)?.hint}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Voice Note (Any Language)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isRecording
                            ? 'border-red-300 bg-red-50 text-red-800'
                            : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        {isRecording ? (
                          <>
                            <Square className="h-3.5 w-3.5 fill-current" />
                            <span className="tabular-nums">
                              Stop ({recordingSeconds}s)
                            </span>
                          </>
                        ) : (
                          <>
                            <Mic className="h-3.5 w-3.5" />
                            <span>Record Voice</span>
                          </>
                        )}
                      </button>
                      <input
                        type="text"
                        value={voiceText}
                        onChange={(e) => setVoiceText(e.target.value)}
                        placeholder="Or type/speak note in any language..."
                        className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-blue-700"
                      />
                    </div>
                    {audioPreviewUrl && (
                      <audio
                        controls
                        src={audioPreviewUrl}
                        className="mt-2 h-8 w-full"
                      />
                    )}
                  </div>
                </div>

                {/* Trigger / Re-analyze Action when user types note or uploads without auto */}
                {(rawImageBase64 || voiceText.trim() || audioBase64) && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      {analyzing
                        ? 'Running clarity gate, privacy blur, translation, and 3-signal duplicate check...'
                        : 'Ready for instant zero-form extraction.'}
                    </span>
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() =>
                        runAiAnalysis({
                          imgBase64: rawImageBase64,
                          imgMime: rawImageMime,
                          audBase64: audioBase64,
                          audMime: audioMimeType,
                          noteText: voiceText,
                          exifIso: exifTimestamp,
                          presetUrl: presetImageUrl,
                        })
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          <span>
                            {isOffline
                              ? 'Save to Offline Queue'
                              : analysis
                                ? 'Re-analyze Report'
                                : 'Analyze Report'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Loading Skeleton */}
                {analyzing && (
                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                    <div className="h-20 w-full animate-pulse rounded-lg bg-slate-100" />
                  </div>
                )}

                {/* AI Output Preview: Quality Gate + Privacy + Duplicate + 1-Tap Submit */}
                {!analyzing && analysis && (
                  <div className="space-y-4 border-t border-slate-200 pt-4">
                    {/* 1. AI Quality Check Result */}
                    {!analysis.qualityCheck.passed ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                          <div>
                            <div className="text-sm font-semibold text-red-900">
                              Capture did not pass quality check
                            </div>
                            <p className="mt-1 text-sm text-red-800">
                              {analysis.qualityCheck.guidanceMessage}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-2 text-xs text-red-700">
                              <span>Clarity: {analysis.qualityCheck.clarityStatus}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                Authenticity: {analysis.qualityCheck.authenticityStatus}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Safety: {analysis.qualityCheck.safetyStatus}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Quality + Privacy Verification Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium text-emerald-800">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                            <span>{analysis.qualityCheck.guidanceMessage}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <EyeOff className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">
                              {analysis.privacyBoxes.length}{' '}
                              {analysis.privacyBoxes.length === 1
                                ? 'face/plate'
                                : 'faces/plates'}{' '}
                              auto-blurred
                            </span>
                          </div>
                        </div>

                        {/* Duplicate Match Banner */}
                        {analysis.duplicateMatch && (
                          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-slate-900">
                                  This issue is already reported nearby. Add your voice?
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-700">
                                  <span className="font-mono font-semibold text-blue-800">
                                    {analysis.duplicateMatch.ticketId}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums">
                                    {analysis.duplicateMatch.distanceMeters} m away
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums">
                                    {analysis.duplicateMatch.combinedScore}% match score
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-semibold tabular-nums">
                                    +{analysis.duplicateMatch.affectedCount} people affected
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={handleAddVoiceToDuplicate}
                                className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                              >
                                {submitting
                                  ? 'Adding voice...'
                                  : `Add Your Voice (+1)`}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Pre-Filled Zero-Form Ticket Summary */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                          {previewImageUrl && (
                            <div className="sm:col-span-4">
                              <div className="aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                <img
                                  src={previewImageUrl}
                                  alt="Privacy-redacted street capture preview"
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            </div>
                          )}

                          <div
                            className={
                              previewImageUrl ? 'sm:col-span-8' : 'sm:col-span-12'
                            }
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span className="font-medium text-slate-800">
                                {CATEGORY_LABELS[overrideCategory]}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                Severity: {SEVERITY_LABELS[analysis.severity]}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {analysis.estimatedSizeOrFlow}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`font-medium tabular-nums ${
                                  analysis.requiresHumanReview
                                    ? 'text-amber-800'
                                    : 'text-emerald-800'
                                }`}
                              >
                                {analysis.confidenceScore}% confidence
                                {analysis.requiresHumanReview
                                  ? ' (Human review queue)'
                                  : ''}
                              </span>
                            </div>

                            <h3 className="font-display mt-1.5 text-lg font-semibold text-slate-900">
                              {overrideTitle}
                            </h3>

                            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                              {analysis.officialSummary}
                            </p>

                            {analysis.extractedDetails.length > 0 && (
                              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                {analysis.extractedDetails.map((detail, idx) => (
                                  <li key={idx}>• {detail}</li>
                                ))}
                              </ul>
                            )}

                            {analysis.originalTranscript && (
                              <div className="mt-2 text-xs text-slate-500">
                                Original note ({analysis.detectedLanguage}): “
                                {analysis.originalTranscript}”
                              </div>
                            )}

                            {editDetailsOpen && (
                              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2">
                                <input
                                  type="text"
                                  value={overrideTitle}
                                  onChange={(e) => setOverrideTitle(e.target.value)}
                                  className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
                                  aria-label="Edit issue title"
                                />
                                <select
                                  value={overrideCategory}
                                  onChange={(e) =>
                                    setOverrideCategory(e.target.value as IssueCategory)
                                  }
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                                  aria-label="Edit issue category"
                                >
                                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                          <button
                            type="button"
                            onClick={() => setEditDetailsOpen((v) => !v)}
                            className="cursor-pointer text-xs font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                          >
                            {editDetailsOpen ? 'Done editing' : 'Adjust pre-filled details'}
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleSubmitTicket}
                            className="cursor-pointer rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                          >
                            {submitting
                              ? 'Issuing Ticket...'
                              : analysis.duplicateMatch
                                ? 'Submit as Separate Ticket'
                                : 'Submit Report'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
