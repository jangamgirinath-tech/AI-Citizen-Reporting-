export type IssueCategory =
  | 'pothole'
  | 'sewage_overflow'
  | 'garbage'
  | 'water_leak'
  | 'streetlight'
  | 'sidewalk_hazard'
  | 'other';

export type TicketStatus =
  | 'submitted'
  | 'ai_verified'
  | 'needs_review'
  | 'dispatched'
  | 'resolved'
  | 'reopened';

export type IssueSeverity = 'low' | 'moderate' | 'high' | 'critical';

export type OfficialLanguage = 'English' | 'Spanish' | 'Hindi' | 'French' | 'Arabic';

export type ReporterTrustTier = 'trusted' | 'standard' | 'rate_limited';

export interface PrivacyRedactionBox {
  label: 'face' | 'license_plate';
  /** Normalized 0-1000 coordinates: [ymin, xmin, ymax, xmax] */
  box2d: [number, number, number, number];
}

export interface QualityCheckResult {
  passed: boolean;
  clarityStatus: 'sharp' | 'blurry' | 'too_dark' | 'too_far';
  authenticityStatus: 'authentic_camera' | 'suspected_screenshot' | 'stock_or_stale';
  safetyStatus: 'clean' | 'irrelevant_or_abusive';
  guidanceMessage: string;
}

export interface DuplicateMatch {
  ticketId: string;
  title: string;
  category: IssueCategory;
  distanceMeters: number;
  visualSimilarity: number;
  textSimilarity: number;
  combinedScore: number;
  affectedCount: number;
  thumbnailUrl: string;
  locationLabel: string;
}

export interface AnalysisResponse {
  qualityCheck: QualityCheckResult;
  title: string;
  category: IssueCategory;
  severity: IssueSeverity;
  estimatedSizeOrFlow: string;
  confidenceScore: number;
  requiresHumanReview: boolean;
  reviewReason?: string;
  originalTranscript: string;
  detectedLanguage: string;
  officialLanguage: OfficialLanguage;
  officialSummary: string;
  extractedDetails: string[];
  privacyBoxes: PrivacyRedactionBox[];
  duplicateMatch: DuplicateMatch | null;
  embeddingVector?: number[];
}

export interface TicketEvidence {
  id: string;
  submittedAt: string;
  imageUrl: string;
  voiceNoteOriginal?: string;
  voiceLanguage?: string;
  reporterTrustTier: ReporterTrustTier;
}

export interface TicketTimelineEntry {
  timestamp: string;
  actor: string;
  message: string;
  status: TicketStatus;
}

export interface AiCorrectionEntry {
  correctedAt: string;
  previousCategory: IssueCategory;
  newCategory: IssueCategory;
  previousSeverity: IssueSeverity;
  newSeverity: IssueSeverity;
  note: string;
}

export interface CivicTicket {
  id: string;
  title: string;
  category: IssueCategory;
  status: TicketStatus;
  severity: IssueSeverity;
  estimatedSizeOrFlow: string;
  confidenceScore: number;
  requiresHumanReview: boolean;
  reviewReason?: string;
  locationLabel: string;
  lat: number;
  lng: number;
  affectedCount: number;
  createdAt: string;
  updatedAt: string;
  officialLanguage: OfficialLanguage;
  officialSummary: string;
  extractedDetails: string[];
  originalTranscript?: string;
  detectedLanguage?: string;
  privacyRedactedCount: number;
  evidence: TicketEvidence[];
  timeline: TicketTimelineEntry[];
  aiCorrectionLog: AiCorrectionEntry[];
  embeddingVector?: number[];
}

export interface TicketsPayload {
  tickets: CivicTicket[];
  stats: {
    totalOpen: number;
    totalAffectedVoices: number;
    needsReviewCount: number;
    resolvedCount: number;
    retrainingSignalsCount: number;
  };
}
