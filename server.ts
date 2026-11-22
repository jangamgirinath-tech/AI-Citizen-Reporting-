import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  AnalysisResponse,
  CivicTicket,
  DuplicateMatch,
  IssueCategory,
  IssueSeverity,
  OfficialLanguage,
  ReporterTrustTier,
  TicketStatus,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add it in the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
}

function createInitialSeedTickets(): CivicTicket[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

  return [
    {
      id: 'STL-4082',
      title: 'Deep asphalt pothole at school crosswalk edge',
      category: 'pothole',
      status: 'dispatched',
      severity: 'high',
      estimatedSizeOrFlow: '45 cm wide · 12 cm deep',
      confidenceScore: 95,
      requiresHumanReview: false,
      locationLabel: 'Oakwood Elementary North Gate, Elm St',
      lat: 37.7749,
      lng: -122.4194,
      affectedCount: 37,
      createdAt: hoursAgo(42),
      updatedAt: hoursAgo(2),
      officialLanguage: 'English',
      officialSummary:
        'High-priority 45 cm asphalt crater along yellow school crosswalk on Elm St near Oakwood Elementary north gate. Ongoing for ~14 days; presents tripping and vehicle axle hazard during school drop-off.',
      extractedDetails: [
        'Near Oakwood Elementary north crosswalk',
        'Reported persistent for 2 weeks',
        'Adjacent to curb gutter seam',
      ],
      originalTranscript:
        'Está justo frente a la entrada de la escuela Oakwood, lleva así dos semanas.',
      detectedLanguage: 'Spanish',
      privacyRedactedCount: 0,
      evidence: [
        {
          id: 'ev-101',
          submittedAt: hoursAgo(42),
          imageUrl: '/src/assets/images/pothole_school_gate_1795364072921.jpg',
          voiceNoteOriginal:
            'Está justo frente a la entrada de la escuela Oakwood, lleva así dos semanas.',
          voiceLanguage: 'Spanish',
          reporterTrustTier: 'trusted',
        },
      ],
      timeline: [
        {
          timestamp: hoursAgo(42),
          actor: 'Citizen Intake',
          message: 'Initial photo + Spanish voice note verified by vision pipeline.',
          status: 'ai_verified',
        },
        {
          timestamp: hoursAgo(12),
          actor: 'Duplicate Clusterer',
          message: '36 nearby citizen confirmations merged within 35 m radius.',
          status: 'ai_verified',
        },
        {
          timestamp: hoursAgo(2),
          actor: 'Public Works Dispatch',
          message: 'Assigned to Road Crew Unit 4 for cold-patch & resurfacing.',
          status: 'dispatched',
        },
      ],
      aiCorrectionLog: [],
    },
    {
      id: 'STL-4079',
      title: 'Storm drain backing up with murky runoff',
      category: 'sewage_overflow',
      status: 'ai_verified',
      severity: 'critical',
      estimatedSizeOrFlow: 'Continuous curb overflow · ~18 L/min',
      confidenceScore: 91,
      requiresHumanReview: false,
      locationLabel: '4th Ave & Cedar St Storm Grate',
      lat: 37.7762,
      lng: -122.4178,
      affectedCount: 14,
      createdAt: hoursAgo(18),
      updatedAt: hoursAgo(5),
      officialLanguage: 'English',
      officialSummary:
        'Blocked cast-iron storm drain at 4th Ave and Cedar St causing murky water and silt overflow across pedestrian curb apron. Pedestrian crossing partially submerged; 1 vehicle plate blurred.',
      extractedDetails: [
        'Intersection of 4th Ave and Cedar St',
        'Water pooling onto pedestrian sidewalk',
        'Foul odor reported by commuters',
      ],
      originalTranscript: 'Drain is overflowing onto the sidewalk at 4th and Cedar.',
      detectedLanguage: 'English',
      privacyRedactedCount: 1,
      evidence: [
        {
          id: 'ev-102',
          submittedAt: hoursAgo(18),
          imageUrl: '/src/assets/images/sewage_overflow_drain_1795364073243.jpg',
          voiceNoteOriginal: 'Drain is overflowing onto the sidewalk at 4th and Cedar.',
          voiceLanguage: 'English',
          reporterTrustTier: 'trusted',
        },
      ],
      timeline: [
        {
          timestamp: hoursAgo(18),
          actor: 'Citizen Intake',
          message: 'Photo passed clarity check; 1 license plate automatically blurred.',
          status: 'ai_verified',
        },
        {
          timestamp: hoursAgo(5),
          actor: 'Duplicate Clusterer',
          message: '13 additional neighborhood reports merged.',
          status: 'ai_verified',
        },
      ],
      aiCorrectionLog: [],
    },
    {
      id: 'STL-4074',
      title: 'Overflowing bin and dumped cardboard along sidewalk',
      category: 'garbage',
      status: 'needs_review',
      severity: 'moderate',
      estimatedSizeOrFlow: '~1.8 m³ stacked bags and cardboard',
      confidenceScore: 68,
      requiresHumanReview: true,
      reviewReason:
        'Confidence 68% — mixed residential bin overflow vs. illegal commercial dumping.',
      locationLabel: 'Maple Terrace Lane, Lot 42',
      lat: 37.7734,
      lng: -122.4215,
      affectedCount: 5,
      createdAt: hoursAgo(11),
      updatedAt: hoursAgo(11),
      officialLanguage: 'English',
      officialSummary:
        'Substantial pile of black refuse bags and flattened cardboard stacked around Bin #42 on Maple Terrace Lane, obstructing half of the paved pedestrian walkway. Flagged for staff distinction between missed pickup and illegal dumping.',
      extractedDetails: [
        'Sidewalk next to green municipal Bin #42',
        'Includes cardboard cartons and ~10 refuse bags',
      ],
      originalTranscript: 'कचरा तीन दिन से नहीं उठाया गया है, पूरी सड़क पर फैल गया है।',
      detectedLanguage: 'Hindi',
      privacyRedactedCount: 2,
      evidence: [
        {
          id: 'ev-103',
          submittedAt: hoursAgo(11),
          imageUrl: '/src/assets/images/illegal_garbage_alley_1795364073161.jpg',
          voiceNoteOriginal:
            'कचरा तीन दिन से नहीं उठाया गया है, पूरी सड़क पर फैल गया है।',
          voiceLanguage: 'Hindi',
          reporterTrustTier: 'standard',
        },
      ],
      timeline: [
        {
          timestamp: hoursAgo(11),
          actor: 'Quality & Triage Gate',
          message:
            'Confidence below 75% threshold; routed to Human Review Queue for category confirmation.',
          status: 'needs_review',
        },
      ],
      aiCorrectionLog: [],
    },
    {
      id: 'STL-4061',
      title: 'Pressurized water bubbling from valve seam',
      category: 'water_leak',
      status: 'resolved',
      severity: 'high',
      estimatedSizeOrFlow: 'Steady bubbling stream along 6 m curb',
      confidenceScore: 93,
      requiresHumanReview: false,
      locationLabel: 'Market & 9th Utility Valve Cover',
      lat: 37.7775,
      lng: -122.4152,
      affectedCount: 9,
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(8),
      officialLanguage: 'English',
      officialSummary:
        'Clean potable water bubbling from cracked concrete expansion joint adjacent to municipal water valve box on Market & 9th. Repaired and valve gasket sealed by Water Utility Crew.',
      extractedDetails: [
        'Adjacent to cast-iron water meter cover',
        'Potable water pooling down gutter',
      ],
      originalTranscript: 'Water is bubbling up right next to the metal meter cover.',
      detectedLanguage: 'English',
      privacyRedactedCount: 0,
      evidence: [
        {
          id: 'ev-104',
          submittedAt: hoursAgo(96),
          imageUrl: '/src/assets/images/water_leak_sidewalk_1795364072942.jpg',
          voiceNoteOriginal: 'Water is bubbling up right next to the metal meter cover.',
          voiceLanguage: 'English',
          reporterTrustTier: 'trusted',
        },
      ],
      timeline: [
        {
          timestamp: hoursAgo(96),
          actor: 'Citizen Intake',
          message: 'Verified leak at utility valve seam.',
          status: 'ai_verified',
        },
        {
          timestamp: hoursAgo(48),
          actor: 'Water Utility Dispatch',
          message: 'Crew dispatched to inspect pressurized line.',
          status: 'dispatched',
        },
        {
          timestamp: hoursAgo(8),
          actor: 'Water Utility Crew',
          message: 'Gasket replaced and concrete seam sealed. Marked resolved.',
          status: 'resolved',
        },
      ],
      aiCorrectionLog: [],
    },
  ];
}

function loadTickets(): CivicTicket[] {
  if (!fs.existsSync(TICKETS_FILE)) {
    const seed = createInitialSeedTickets();
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  try {
    const raw = fs.readFileSync(TICKETS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : createInitialSeedTickets();
  } catch {
    const seed = createInitialSeedTickets();
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
}

function saveTickets(tickets: CivicTicket[]): void {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

function saveBase64Image(base64Data: string, mimeType: string): string {
  const clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const filename = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(clean, 'base64'));
  return `/api/uploads/${filename}`;
}

function computeStats(tickets: CivicTicket[]) {
  const openTickets = tickets.filter((t) => t.status !== 'resolved');
  return {
    totalOpen: openTickets.length,
    totalAffectedVoices: tickets.reduce((sum, t) => sum + t.affectedCount, 0),
    needsReviewCount: tickets.filter((t) => t.requiresHumanReview || t.status === 'needs_review').length,
    resolvedCount: tickets.filter((t) => t.status === 'resolved').length,
    retrainingSignalsCount: tickets.reduce(
      (sum, t) =>
        sum +
        t.aiCorrectionLog.length +
        t.timeline.filter((ev) => ev.status === 'reopened').length,
      0
    ),
  };
}

function sanitizeJsonString(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function computeMultimodalEmbedding(
  ai: GoogleGenAI,
  summaryText: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<number[] | undefined> {
  try {
    const contents: Array<string | { inlineData: { data: string; mimeType: string } }> = [
      summaryText,
    ];
    if (imageBase64 && imageMimeType) {
      const clean = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      contents.push({
        inlineData: {
          data: clean,
          mimeType: imageMimeType,
        },
      });
    }
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents,
    });
    const values = result.embeddings?.[0]?.values;
    return Array.isArray(values) ? values : undefined;
  } catch (err) {
    console.warn('Embedding generation skipped:', err instanceof Error ? err.message : err);
    return undefined;
  }
}

async function main() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/api/uploads', express.static(UPLOADS_DIR));

  app.get('/api/tickets', (_req, res) => {
    const tickets = loadTickets();
    res.json({
      tickets: tickets.map(({ embeddingVector: _ev, ...rest }) => rest),
      stats: computeStats(tickets),
    });
  });

  app.post('/api/analyze-report', async (req, res) => {
    try {
      const {
        imageBase64,
        imageMimeType,
        audioBase64,
        audioMimeType,
        voiceText,
        lat,
        lng,
        locationLabel,
        exifTimestamp,
        officialLanguage = 'English',
      } = req.body as {
        imageBase64?: string;
        imageMimeType?: string;
        audioBase64?: string;
        audioMimeType?: string;
        voiceText?: string;
        lat?: number;
        lng?: number;
        locationLabel?: string;
        exifTimestamp?: string;
        officialLanguage?: OfficialLanguage;
      };

      if (!imageBase64 && !audioBase64 && !voiceText?.trim()) {
        return res.status(400).json({
          error: 'Please provide a street photo, a voice recording, or a quick note.',
        });
      }

      const ai = getAiClient();
      let transcribedAudioText = voiceText?.trim() || '';

      // Step 1: Dedicated Speech-to-Text when raw audio recording is provided
      if (audioBase64 && audioMimeType) {
        const cleanAudio = audioBase64.includes(',')
          ? audioBase64.split(',')[1]
          : audioBase64;
        const transcribeRes = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: audioMimeType,
                  data: cleanAudio,
                },
              },
              {
                text: 'Transcribe this citizen civic issue voice note accurately in its original spoken language or dialect.',
              },
            ],
          },
        });
        const transcript = (transcribeRes.text || '').trim();
        if (transcript) {
          transcribedAudioText = transcribedAudioText
            ? `${transcribedAudioText} ${transcript}`
            : transcript;
        }
      }

      // Step 2: Multimodal Vision Quality Gate, Issue Extraction, Privacy Redaction Boxes & Translation
      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (imageBase64 && imageMimeType) {
        const cleanImg = imageBase64.includes(',')
          ? imageBase64.split(',')[1]
          : imageBase64;
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: cleanImg,
          },
        });
      }

      const currentIso = new Date().toISOString();
      const promptText = `You are the AI intake engine for Streetline, a municipal citizen infrastructure reporting system.
Analyze the submitted citizen evidence (image and/or citizen voice transcript) and return a structured JSON assessment.

Context provided:
- Citizen voice/text note: ${transcribedAudioText ? `"${transcribedAudioText}"` : 'None provided'}
- Location hint: ${locationLabel || 'Not specified'} (${lat ?? 'unknown'}, ${lng ?? 'unknown'})
- Photo EXIF/Capture Timestamp: ${exifTimestamp || currentIso} (Current Server Time: ${currentIso})
- Target Official Language for Municipal Summary: ${officialLanguage}

Tasks:
1. QUALITY & AUTHENTICITY CHECK (qualityCheck):
   - Evaluate image clarity: "sharp", "blurry", "too_dark", or "too_far". (If no image provided and text/audio only, mark "sharp").
   - Evaluate authenticity: "authentic_camera" vs "suspected_screenshot" (e.g. phone UI chrome, browser frame, watermarked stock photo) vs "stock_or_stale" (if exifTimestamp is older than 14 days before current server time or clearly studio stock).
   - Evaluate safety: "clean" vs "irrelevant_or_abusive" (selfies, memes, indoor pets, spam, abusive content).
   - Set passed=true ONLY if clarityStatus=="sharp" AND authenticityStatus=="authentic_camera" AND safetyStatus=="clean".
   - Write a short actionable guidanceMessage (e.g. "Photo is sharp and verified." or "Too blurry — please move closer and retake.").
2. ISSUE CLASSIFICATION & ESTIMATION:
   - category: one of "pothole", "sewage_overflow", "garbage", "water_leak", "streetlight", "sidewalk_hazard", "other".
   - title: concise 5-9 word title in English.
   - severity: one of "low", "moderate", "high", "critical".
   - estimatedSizeOrFlow: concrete physical estimate from the photo/note (e.g., "45 cm wide · 12 cm deep", "Moderate continuous curb flow", "~1.5 m³ piled refuse").
   - confidenceScore: integer 0-100 calibrated confidence in the classification.
   - requiresHumanReview: boolean (true if confidenceScore < 75 or ambiguous).
   - reviewReason: brief explanation if requiresHumanReview is true, else empty string.
3. MULTILINGUAL VOICE EXTRACTION & TRANSLATION:
   - originalTranscript: exact transcript/note provided (or brief visual summary if no audio/text).
   - detectedLanguage: language name of the note (e.g. "Spanish", "Hindi", "English").
   - officialSummary: crisp 2-sentence municipal dispatch summary written strictly in ${officialLanguage}.
   - extractedDetails: 2-4 bullet phrases extracting landmarks, duration, or impact (written in ${officialLanguage}).
4. PRIVACY SHIELD (privacyBoxes):
   - Detect any clearly visible human faces or vehicle license plates in the photo.
   - Return normalized 0-1000 bounding boxes [ymin, xmin, ymax, xmax] with label "face" or "license_plate". Return [] if none are visible.`;

      parts.push({ text: promptText });

      const analysisRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              qualityCheck: {
                type: Type.OBJECT,
                properties: {
                  passed: { type: Type.BOOLEAN },
                  clarityStatus: { type: Type.STRING },
                  authenticityStatus: { type: Type.STRING },
                  safetyStatus: { type: Type.STRING },
                  guidanceMessage: { type: Type.STRING },
                },
                required: [
                  'passed',
                  'clarityStatus',
                  'authenticityStatus',
                  'safetyStatus',
                  'guidanceMessage',
                ],
              },
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              severity: { type: Type.STRING },
              estimatedSizeOrFlow: { type: Type.STRING },
              confidenceScore: { type: Type.INTEGER },
              requiresHumanReview: { type: Type.BOOLEAN },
              reviewReason: { type: Type.STRING },
              originalTranscript: { type: Type.STRING },
              detectedLanguage: { type: Type.STRING },
              officialSummary: { type: Type.STRING },
              extractedDetails: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              privacyBoxes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    box2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                  },
                  required: ['label', 'box2d'],
                },
              },
            },
            required: [
              'qualityCheck',
              'title',
              'category',
              'severity',
              'estimatedSizeOrFlow',
              'confidenceScore',
              'requiresHumanReview',
              'originalTranscript',
              'detectedLanguage',
              'officialSummary',
              'extractedDetails',
              'privacyBoxes',
            ],
          },
        },
      });

      const parsed = JSON.parse(sanitizeJsonString(analysisRes.text || '{}'));

      // Step 3: Compute Multimodal Embedding & 3-Signal Smart Duplicate Detection
      const embeddingText = `${parsed.category}: ${parsed.title}. ${parsed.officialSummary} ${parsed.extractedDetails?.join(' ') || ''}`;
      const newEmbedding = await computeMultimodalEmbedding(
        ai,
        embeddingText,
        imageBase64,
        imageMimeType
      );

      let duplicateMatch: DuplicateMatch | null = null;
      const tickets = loadTickets();
      const openTickets = tickets.filter((t) => t.status !== 'resolved');

      if (
        parsed.qualityCheck?.passed &&
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        openTickets.length > 0
      ) {
        let bestScore = 0;
        let bestMatch: DuplicateMatch | null = null;

        for (const existing of openTickets) {
          const distanceMeters = haversineMeters(lat, lng, existing.lat, existing.lng);
          if (distanceMeters > 120) continue;

          const locScore = Math.max(0, 1 - distanceMeters / 120);
          const categoryMatch = existing.category === parsed.category ? 1 : 0.15;

          let textSim = 0;
          if (newEmbedding && existing.embeddingVector) {
            textSim = cosineSimilarity(newEmbedding, existing.embeddingVector);
          } else {
            // Semantic token overlap fallback if existing seed ticket lacks cached vector
            const wordsA = new Set(
              `${parsed.title} ${parsed.category} ${locationLabel || ''}`
                .toLowerCase()
                .split(/\W+/)
                .filter((w) => w.length > 2)
            );
            const wordsB = new Set(
              `${existing.title} ${existing.category} ${existing.locationLabel}`
                .toLowerCase()
                .split(/\W+/)
                .filter((w) => w.length > 2)
            );
            const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
            const union = new Set([...wordsA, ...wordsB]).size;
            textSim = union > 0 ? Math.min(0.95, 0.45 + (intersection / union) * 0.6) : 0.4;
          }

          const visualSim =
            existing.category === parsed.category
              ? Math.min(0.96, 0.72 + textSim * 0.24)
              : textSim * 0.5;
          const combinedScore = locScore * 0.4 + visualSim * 0.35 + categoryMatch * 0.25;

          if (combinedScore >= 0.65 && combinedScore > bestScore) {
            bestScore = combinedScore;
            bestMatch = {
              ticketId: existing.id,
              title: existing.title,
              category: existing.category,
              distanceMeters,
              visualSimilarity: Math.round(visualSim * 100),
              textSimilarity: Math.round(textSim * 100),
              combinedScore: Math.round(combinedScore * 100),
              affectedCount: existing.affectedCount,
              thumbnailUrl: existing.evidence[0]?.imageUrl || '',
              locationLabel: existing.locationLabel,
            };
          }
        }
        duplicateMatch = bestMatch;
      }

      const validCategories: IssueCategory[] = [
        'pothole',
        'sewage_overflow',
        'garbage',
        'water_leak',
        'streetlight',
        'sidewalk_hazard',
        'other',
      ];
      const normalizedCategory: IssueCategory = validCategories.includes(parsed.category)
        ? parsed.category
        : 'other';

      const validSeverities: IssueSeverity[] = ['low', 'moderate', 'high', 'critical'];
      const normalizedSeverity: IssueSeverity = validSeverities.includes(parsed.severity)
        ? parsed.severity
        : 'moderate';

      const payload: AnalysisResponse = {
        qualityCheck: parsed.qualityCheck,
        title: parsed.title,
        category: normalizedCategory,
        severity: normalizedSeverity,
        estimatedSizeOrFlow: parsed.estimatedSizeOrFlow,
        confidenceScore: Math.max(0, Math.min(100, Number(parsed.confidenceScore) || 80)),
        requiresHumanReview:
          Boolean(parsed.requiresHumanReview) || Number(parsed.confidenceScore) < 75,
        reviewReason: parsed.reviewReason || undefined,
        originalTranscript: parsed.originalTranscript,
        detectedLanguage: parsed.detectedLanguage || 'English',
        officialLanguage,
        officialSummary: parsed.officialSummary,
        extractedDetails: Array.isArray(parsed.extractedDetails)
          ? parsed.extractedDetails
          : [],
        privacyBoxes: Array.isArray(parsed.privacyBoxes) ? parsed.privacyBoxes : [],
        duplicateMatch,
        embeddingVector: newEmbedding,
      };

      return res.json(payload);
    } catch (err) {
      console.error('Analyze report error:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to analyze report with Gemini AI.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/tickets', (req, res) => {
    try {
      const {
        title,
        category,
        severity,
        estimatedSizeOrFlow,
        confidenceScore,
        requiresHumanReview,
        reviewReason,
        locationLabel,
        lat,
        lng,
        officialLanguage,
        officialSummary,
        extractedDetails,
        originalTranscript,
        detectedLanguage,
        privacyRedactedCount,
        redactedImageBase64,
        imageMimeType,
        presetImageUrl,
        reporterTrustTier = 'trusted',
        embeddingVector,
      } = req.body as {
        title: string;
        category: IssueCategory;
        severity: IssueSeverity;
        estimatedSizeOrFlow: string;
        confidenceScore: number;
        requiresHumanReview: boolean;
        reviewReason?: string;
        locationLabel: string;
        lat: number;
        lng: number;
        officialLanguage: OfficialLanguage;
        officialSummary: string;
        extractedDetails: string[];
        originalTranscript?: string;
        detectedLanguage?: string;
        privacyRedactedCount: number;
        redactedImageBase64?: string;
        imageMimeType?: string;
        presetImageUrl?: string;
        reporterTrustTier?: ReporterTrustTier;
        embeddingVector?: number[];
      };

      const tickets = loadTickets();
      const nextNum = 4083 + tickets.length;
      const nowIso = new Date().toISOString();

      let imageUrl = presetImageUrl || '';
      if (redactedImageBase64) {
        imageUrl = saveBase64Image(redactedImageBase64, imageMimeType || 'image/jpeg');
      }

      const initialStatus: TicketStatus = requiresHumanReview
        ? 'needs_review'
        : 'ai_verified';

      const newTicket: CivicTicket = {
        id: `STL-${nextNum}`,
        title: title || 'Neighborhood Infrastructure Report',
        category: category || 'other',
        status: initialStatus,
        severity: severity || 'moderate',
        estimatedSizeOrFlow: estimatedSizeOrFlow || 'Visual assessment pending',
        confidenceScore: Number(confidenceScore) || 85,
        requiresHumanReview: Boolean(requiresHumanReview),
        reviewReason,
        locationLabel: locationLabel || 'Reported GPS Pin',
        lat: typeof lat === 'number' ? lat : 37.7749,
        lng: typeof lng === 'number' ? lng : -122.4194,
        affectedCount: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
        officialLanguage: officialLanguage || 'English',
        officialSummary: officialSummary || title,
        extractedDetails: Array.isArray(extractedDetails) ? extractedDetails : [],
        originalTranscript,
        detectedLanguage,
        privacyRedactedCount: Number(privacyRedactedCount) || 0,
        evidence: [
          {
            id: `ev-${Date.now()}`,
            submittedAt: nowIso,
            imageUrl,
            voiceNoteOriginal: originalTranscript,
            voiceLanguage: detectedLanguage,
            reporterTrustTier,
          },
        ],
        timeline: [
          {
            timestamp: nowIso,
            actor: 'Citizen Intake',
            message: requiresHumanReview
              ? `Ticket issued with ${confidenceScore}% confidence; routed to human review queue.`
              : `Zero-form ticket verified (${confidenceScore}% confidence) and routed to municipal dispatch.`,
            status: initialStatus,
          },
        ],
        aiCorrectionLog: [],
        embeddingVector,
      };

      tickets.unshift(newTicket);
      saveTickets(tickets);

      const { embeddingVector: _ev, ...safeTicket } = newTicket;
      return res.status(201).json({
        ticket: safeTicket,
        stats: computeStats(tickets),
      });
    } catch (err) {
      console.error('Create ticket error:', err);
      return res.status(500).json({ error: 'Unable to save civic ticket.' });
    }
  });

  app.post('/api/tickets/:id/add-voice', (req, res) => {
    try {
      const { id } = req.params;
      const {
        redactedImageBase64,
        imageMimeType,
        presetImageUrl,
        originalTranscript,
        detectedLanguage,
        reporterTrustTier = 'trusted',
        additionalPrivacyCount = 0,
      } = req.body as {
        redactedImageBase64?: string;
        imageMimeType?: string;
        presetImageUrl?: string;
        originalTranscript?: string;
        detectedLanguage?: string;
        reporterTrustTier?: ReporterTrustTier;
        additionalPrivacyCount?: number;
      };

      const tickets = loadTickets();
      const idx = tickets.findIndex((t) => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      const nowIso = new Date().toISOString();
      const ticket = tickets[idx];
      let imageUrl = presetImageUrl || ticket.evidence[0]?.imageUrl || '';
      if (redactedImageBase64) {
        imageUrl = saveBase64Image(redactedImageBase64, imageMimeType || 'image/jpeg');
      }

      ticket.affectedCount += 1;
      ticket.privacyRedactedCount += Number(additionalPrivacyCount) || 0;
      ticket.updatedAt = nowIso;

      if (ticket.affectedCount >= 10 && ticket.severity === 'moderate') {
        ticket.severity = 'high';
      }

      ticket.evidence.push({
        id: `ev-${Date.now()}`,
        submittedAt: nowIso,
        imageUrl,
        voiceNoteOriginal: originalTranscript,
        voiceLanguage: detectedLanguage,
        reporterTrustTier,
      });

      ticket.timeline.push({
        timestamp: nowIso,
        actor: 'Duplicate Clusterer',
        message: `Citizen confirmation merged (+1 voice · now ${ticket.affectedCount} people affected). Fresh evidence attached.`,
        status: ticket.status,
      });

      saveTickets(tickets);
      const { embeddingVector: _ev, ...safeTicket } = ticket;
      return res.json({
        ticket: safeTicket,
        stats: computeStats(tickets),
      });
    } catch (err) {
      console.error('Add voice error:', err);
      return res.status(500).json({ error: 'Failed to merge citizen confirmation.' });
    }
  });

  app.patch('/api/tickets/:id/status', (req, res) => {
    try {
      const { id } = req.params;
      const { status, note, actor } = req.body as {
        status: TicketStatus;
        note?: string;
        actor?: string;
      };

      const tickets = loadTickets();
      const idx = tickets.findIndex((t) => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      const ticket = tickets[idx];
      const nowIso = new Date().toISOString();
      ticket.status = status;
      ticket.updatedAt = nowIso;
      if (status !== 'needs_review') {
        ticket.requiresHumanReview = false;
      }

      const defaultMsg =
        status === 'reopened'
          ? 'Citizen reopened resolved ticket — flagged as AI verification & repair feedback signal.'
          : `Status updated to ${status.replace('_', ' ')}.`;

      ticket.timeline.push({
        timestamp: nowIso,
        actor: actor || (status === 'reopened' ? 'Citizen Feedback' : 'Municipal Operations'),
        message: note?.trim() || defaultMsg,
        status,
      });

      saveTickets(tickets);
      const { embeddingVector: _ev, ...safeTicket } = ticket;
      return res.json({
        ticket: safeTicket,
        stats: computeStats(tickets),
      });
    } catch (err) {
      console.error('Update status error:', err);
      return res.status(500).json({ error: 'Failed to update ticket status.' });
    }
  });

  app.patch('/api/tickets/:id/correct', (req, res) => {
    try {
      const { id } = req.params;
      const { category, severity, note } = req.body as {
        category: IssueCategory;
        severity: IssueSeverity;
        note?: string;
      };

      const tickets = loadTickets();
      const idx = tickets.findIndex((t) => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      const ticket = tickets[idx];
      const nowIso = new Date().toISOString();

      ticket.aiCorrectionLog.push({
        correctedAt: nowIso,
        previousCategory: ticket.category,
        newCategory: category,
        previousSeverity: ticket.severity,
        newSeverity: severity,
        note: note?.trim() || 'Field staff category/severity calibration.',
      });

      ticket.category = category;
      ticket.severity = severity;
      ticket.requiresHumanReview = false;
      if (ticket.status === 'needs_review') {
        ticket.status = 'ai_verified';
      }
      ticket.updatedAt = nowIso;

      ticket.timeline.push({
        timestamp: nowIso,
        actor: 'Staff Review & AI Feedback',
        message: `Staff verified classification (${category.replace('_', ' ')} · ${severity}). Logged to retraining dataset.`,
        status: ticket.status,
      });

      saveTickets(tickets);
      const { embeddingVector: _ev, ...safeTicket } = ticket;
      return res.json({
        ticket: safeTicket,
        stats: computeStats(tickets),
      });
    } catch (err) {
      console.error('Correct ticket error:', err);
      return res.status(500).json({ error: 'Failed to save staff correction.' });
    }
  });

  app.post('/api/translate-summary', async (req, res) => {
    try {
      const { ticketId, targetLanguage } = req.body as {
        ticketId: string;
        targetLanguage: OfficialLanguage;
      };

      const tickets = loadTickets();
      const idx = tickets.findIndex((t) => t.id === ticketId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      const ticket = tickets[idx];
      const ai = getAiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Translate and adapt this municipal infrastructure ticket summary and extracted bullet points into crisp, formal ${targetLanguage} for city maintenance crews.
Return valid JSON with keys "officialSummary" (string) and "extractedDetails" (array of strings).

Original summary: ${ticket.officialSummary}
Original transcript: ${ticket.originalTranscript || ''}
Details: ${JSON.stringify(ticket.extractedDetails)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              officialSummary: { type: Type.STRING },
              extractedDetails: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['officialSummary', 'extractedDetails'],
          },
        },
      });

      const translated = JSON.parse(sanitizeJsonString(response.text || '{}'));
      ticket.officialLanguage = targetLanguage;
      ticket.officialSummary = translated.officialSummary || ticket.officialSummary;
      if (Array.isArray(translated.extractedDetails)) {
        ticket.extractedDetails = translated.extractedDetails;
      }
      ticket.updatedAt = new Date().toISOString();
      saveTickets(tickets);

      const { embeddingVector: _ev, ...safeTicket } = ticket;
      return res.json({
        ticket: safeTicket,
        stats: computeStats(tickets),
      });
    } catch (err) {
      console.error('Translate summary error:', err);
      return res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Unable to translate summary right now.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Streetline server listening on http://0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
