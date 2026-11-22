import type {
  IssueCategory,
  IssueSeverity,
  OfficialLanguage,
  PrivacyRedactionBox,
  TicketStatus,
} from '../types';

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  pothole: 'Pothole',
  sewage_overflow: 'Drain / Sewage Overflow',
  garbage: 'Refuse / Dumping',
  water_leak: 'Water Leak',
  streetlight: 'Streetlight Outage',
  sidewalk_hazard: 'Sidewalk Hazard',
  other: 'Other Infrastructure',
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  submitted: 'Submitted',
  ai_verified: 'AI Verified',
  needs_review: 'Needs Human Review',
  dispatched: 'Crew Dispatched',
  resolved: 'Resolved',
  reopened: 'Reopened',
};

export const OFFICIAL_LANGUAGES: OfficialLanguage[] = [
  'English',
  'Spanish',
  'Hindi',
  'French',
  'Arabic',
];

export interface LocationPreset {
  id: string;
  label: string;
  lat: number;
  lng: number;
  hint: string;
}

export const LOCATION_PRESETS: LocationPreset[] = [
  {
    id: 'oakwood-gate',
    label: 'Oakwood Elementary North Gate, Elm St',
    lat: 37.77492,
    lng: -122.41938,
    hint: 'Near active STL-4082 cluster (~12 m)',
  },
  {
    id: 'cedar-drain',
    label: '4th Ave & Cedar St Storm Grate',
    lat: 37.77621,
    lng: -122.41782,
    hint: 'Near active STL-4079 cluster (~8 m)',
  },
  {
    id: 'pine-plaza',
    label: 'Pine St Transit Plaza, West Curb',
    lat: 37.7798,
    lng: -122.4235,
    hint: 'New block (no open nearby tickets)',
  },
];

export interface SampleCapturePreset {
  id: string;
  label: string;
  imageUrl: string;
  defaultLocationId: string;
  sampleVoiceText: string;
  sampleVoiceLang: string;
}

export const SAMPLE_CAPTURES: SampleCapturePreset[] = [
  {
    id: 'sample-pothole',
    label: 'School Crosswalk Pothole',
    imageUrl: '/src/assets/images/pothole_school_gate_1795364072921.jpg',
    defaultLocationId: 'oakwood-gate',
    sampleVoiceText:
      'Está justo frente a la entrada de la escuela Oakwood, lleva así dos semanas y los niños tropiezan.',
    sampleVoiceLang: 'Spanish',
  },
  {
    id: 'sample-sewage',
    label: 'Storm Drain Overflow',
    imageUrl: '/src/assets/images/sewage_overflow_drain_1795364073243.jpg',
    defaultLocationId: 'cedar-drain',
    sampleVoiceText:
      'Water and mud are pouring out of the storm grate onto the sidewalk since this morning.',
    sampleVoiceLang: 'English',
  },
  {
    id: 'sample-garbage',
    label: 'Overflowing Curbside Waste',
    imageUrl: '/src/assets/images/illegal_garbage_alley_1795364073161.jpg',
    defaultLocationId: 'pine-plaza',
    sampleVoiceText:
      'कचरा तीन दिन से नहीं उठाया गया है, पूरी फुटपाथ पर फैल गया है।',
    sampleVoiceLang: 'Hindi',
  },
  {
    id: 'sample-leak',
    label: 'Sidewalk Valve Water Leak',
    imageUrl: '/src/assets/images/water_leak_sidewalk_1795364072942.jpg',
    defaultLocationId: 'pine-plaza',
    sampleVoiceText:
      "Il y a de l'eau claire qui sort de la fissure à côté de la vanne depuis hier soir.",
    sampleVoiceLang: 'French',
  },
];

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export async function fileToBase64(
  file: Blob
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = file.type || 'image/jpeg';
      resolve({ base64: result, mimeType });
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export async function imageUrlToBase64(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not load sample image.');
  }
  const blob = await response.blob();
  return fileToBase64(blob);
}

/**
 * Applies pixelation + blur over detected face and license plate regions
 * using normalized [ymin, xmin, ymax, xmax] 0-1000 coordinates.
 */
export async function applyPrivacyRedactionToDataUrl(
  imageDataUrl: string,
  boxes: PrivacyRedactionBox[]
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      if (boxes && boxes.length > 0) {
        for (const item of boxes) {
          if (!Array.isArray(item.box2d) || item.box2d.length !== 4) continue;
          const [ymin, xmin, ymax, xmax] = item.box2d;
          const x = Math.max(0, Math.floor((xmin / 1000) * width));
          const y = Math.max(0, Math.floor((ymin / 1000) * height));
          const w = Math.max(8, Math.ceil(((xmax - xmin) / 1000) * width));
          const h = Math.max(8, Math.ceil(((ymax - ymin) / 1000) * height));

          // Two-pass blur + coarse pixelation block
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          ctx.filter = 'blur(12px)';
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = 'none';
          ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
          ctx.fillRect(x, y, w, h);
          ctx.restore();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, w, h);
        }
      }

      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

export function speakPrompt(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis unavailable in current browser context
  }
}
