/** A modal session owns its write and close animation, even across rapid reopenings. */
export function createModalSubmissionGuard() {
  let session = 0;
  let phase: 'closed' | 'idle' | 'submitting' | 'closing' = 'closed';

  return {
    open() {
      session += 1;
      phase = 'idle';
    },
    invalidate() {
      session += 1;
      phase = 'closed';
    },
    canSubmit() {
      return phase === 'idle';
    },
    beginSubmission() {
      if (phase !== 'idle') return null;
      phase = 'submitting';
      return session;
    },
    failSubmission(token: number) {
      if (token !== session || phase !== 'submitting') return false;
      phase = 'idle';
      return true;
    },
    completeSubmission(token: number) {
      if (token !== session || phase !== 'submitting') return false;
      phase = 'closing';
      return true;
    },
    beginDismissal() {
      // Dismissing a pending write would lose its success result or permit another payment.
      if (phase !== 'idle') return null;
      phase = 'closing';
      return session;
    },
    finishDismissal(token: number) {
      if (token !== session || phase !== 'closing') return false;
      phase = 'closed';
      return true;
    },
  };
}
