-- More reasons to report: the ones the law treats specially (child safety, intimate images shared
-- without consent, copyright) and the ones this community needs (harassment, dangerous driving).
-- Own migration so the values commit before anything uses them.
alter type public.report_reason add value if not exists 'harassment';
alter type public.report_reason add value if not exists 'intimate_image';
alter type public.report_reason add value if not exists 'child_safety';
alter type public.report_reason add value if not exists 'dangerous_driving';
alter type public.report_reason add value if not exists 'copyright';
