-- AddUniqueConstraint: Grade (enrollmentId, subjectId, period, evalType)
-- Prevent duplicate grade entries for the same evaluation
CREATE UNIQUE INDEX IF NOT EXISTS "Grade_enrollmentId_subjectId_period_evalType_key"
  ON "Grade"("enrollmentId", "subjectId", "period", "evalType");
