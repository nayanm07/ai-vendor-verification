const LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  UNDER_REVIEW: 'Under Review',
  ACTION_REQUIRED: 'Action Required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  VERIFIED: 'Verified',
  MISMATCH: 'Mismatch',
  UNABLE_TO_VERIFY: 'Unable to Verify',
  AVAILABLE: 'Available',
  MISSING: 'Missing',
  MATCH: 'Match',
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  EXTRACTED: 'Extracted',
  FAILED: 'Failed',
  SENT: 'Sent',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>
      <span className="dot" />
      {LABELS[value] ?? value}
    </span>
  )
}
