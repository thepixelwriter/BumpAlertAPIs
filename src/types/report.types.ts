/** Severity classification, mirrors the mobile app's model. */
export type HazardSeverity = 'moderate' | 'severe';

/** Lifecycle state of a hazard report as it moves through agency review. */
export type ReportStatus = 'submitted' | 'in_review' | 'resolved' | 'rejected';

/** A single hazard reported by the mobile app's sensor detection service. */
export interface HazardInput {
  latitude: number;
  longitude: number;
  /** Epoch milliseconds at the moment the spike was detected on-device. */
  timestamp: number;
  severity: HazardSeverity;
}

/** Bulk submission payload sent from the trip-summary review screen. */
export interface HazardSubmissionInput {
  deviceId?: string;
  submittedAt: number;
  hazards: HazardInput[];
}
