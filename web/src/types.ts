export type JobStatus = 'new' | 'reviewed' | 'applied' | 'discarded';

export interface ExtractedJobData {
  title: string | null;
  company: string | null;
  location: string | null;
  requirements: string[];
  salary: string | null;
  contactMethod: string | null;
}

// Mirrors JobRow from src/storage/jobStore.ts plus the fields the API adds
// (extracted, image_url) in place of the raw extracted_json/image_path.
export interface Job {
  id: number;
  group_jid: string;
  sender: string | null;
  message_id: string | null;
  message_timestamp: number | null;
  image_path: string;
  metadata_path: string;
  image_hash: string;
  duplicate_of_id: number | null;
  caption: string | null;
  ocr_text: string | null;
  ocr_confidence: number | null;
  ocr_has_keyword: number;
  extracted_json: string | null;
  extraction_skipped_reason: string | null;
  keyword_match: number | null;
  matched_keyword: string | null;
  discard_reason: string | null;
  relevance_score: number | null;
  relevance_reasoning: string | null;
  relevance_skipped_reason: string | null;
  notified_at: string | null;
  status: JobStatus;
  created_at: string;
  extracted: ExtractedJobData | null;
  image_url: string;
}

export interface Settings {
  profile: string;
  threshold: number;
  keywordsEs: string[];
  keywordsEn: string[];
  skillKeywords: string[];
  acronyms: string[];
  country: string;
  language: string;
  keywordFilterEnabled: boolean;
  candidateGender: CandidateGender;
  acceptLowerLevelRoles: boolean;
  acceptEntryLevelAnyField: boolean;
  notificationLanguage: NotificationLanguage;
}

export type CandidateGender = 'unspecified' | 'female' | 'male';

export type NotificationLanguage = 'en' | 'es';

export type CvProfileDraft = Pick<Settings, 'profile' | 'keywordsEs' | 'keywordsEn' | 'skillKeywords' | 'acronyms'>;
