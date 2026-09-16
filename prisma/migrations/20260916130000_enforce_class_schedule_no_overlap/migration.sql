CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ClassScheduleSlot"
ADD CONSTRAINT "ClassScheduleSlot_no_class_overlap"
EXCLUDE USING GIST (
  "schoolId" WITH =,
  "classPeriodId" WITH =,
  "weekday" WITH =,
  (
    int4range(
      split_part("startTime", ':', 1)::integer * 60 + split_part("startTime", ':', 2)::integer,
      split_part("endTime", ':', 1)::integer * 60 + split_part("endTime", ':', 2)::integer,
      '[)'
    )
  ) WITH &&
);
