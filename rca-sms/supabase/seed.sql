-- ==============================================================================
-- ROYAL CROWN ACADEMY - SUPABASE SEED DATA (OFFICIAL INSTITUTIONAL BASELINE)
-- ==============================================================================

-- 1. Default Super Administrator (Executive / System Admin)
INSERT INTO public.staff (
    staff_id,
    full_name,
    username,
    email,
    phone,
    role,
    assigned_subjects,
    assigned_class,
    is_form_master,
    email_verified,
    status
) VALUES (
    'RCA/PERS/025',
    'Dominic (Administrator)',
    'dominic370',
    'dominic370@royalcrownacademy.edu.ng',
    '08031234567',
    'SUPER_ADMIN',
    '["Information & Communication Technology", "Data Processing"]'::jsonb,
    'SS 2A',
    true,
    true,
    'Active'
) ON CONFLICT (staff_id) DO NOTHING;

-- 2. Multi-Tier Adjustable Grading Scales
INSERT INTO public.grading_tiers (id, tier_title, description, applicable_classes, brackets) VALUES
(
    'PRE_PLAY_PLAY',
    'Creche & Playgroup (Sensory & Developmental Rating)',
    'Milestone observation and developmental psychomotor rating scale for early childhood toddlers.',
    '["Pre-Play Class", "Play Class"]'::jsonb,
    '[
        {"grade": "EE", "minScore": 85, "maxScore": 100, "gradePoint": 4.0, "remark": "Exceeding Expectations", "classification": "Distinction", "colorBadge": "bg-purple-100 text-purple-800 border-purple-300"},
        {"grade": "ME", "minScore": 70, "maxScore": 84, "gradePoint": 3.0, "remark": "Meeting Expectations", "classification": "Credit", "colorBadge": "bg-emerald-100 text-emerald-800 border-emerald-300"},
        {"grade": "AE", "minScore": 50, "maxScore": 69, "gradePoint": 2.0, "remark": "Approaching Expectations", "classification": "Pass", "colorBadge": "bg-amber-100 text-amber-800 border-amber-300"},
        {"grade": "EM", "minScore": 0, "maxScore": 49, "gradePoint": 1.0, "remark": "Emerging Learner", "classification": "Needs Support", "colorBadge": "bg-rose-100 text-rose-800 border-rose-300"}
    ]'::jsonb
),
(
    'NURSERY',
    'Nursery 1 & 2 (Early Phonics & Numeracy Scale)',
    'Foundational literacy, phonetics, and basic arithmetic grading brackets for nursery pupils.',
    '["Nursery 1", "Nursery 2"]'::jsonb,
    '[
        {"grade": "A+", "minScore": 90, "maxScore": 100, "gradePoint": 5.0, "remark": "Exceptional Master", "classification": "Distinction", "colorBadge": "bg-purple-100 text-purple-800 border-purple-300"},
        {"grade": "A", "minScore": 80, "maxScore": 89, "gradePoint": 4.0, "remark": "Excellent Comprehension", "classification": "Distinction", "colorBadge": "bg-blue-100 text-blue-800 border-blue-300"},
        {"grade": "B", "minScore": 70, "maxScore": 79, "gradePoint": 3.0, "remark": "Very Good Ability", "classification": "Credit", "colorBadge": "bg-emerald-100 text-emerald-800 border-emerald-300"},
        {"grade": "C", "minScore": 60, "maxScore": 69, "gradePoint": 2.0, "remark": "Good Progress", "classification": "Pass", "colorBadge": "bg-amber-100 text-amber-800 border-amber-300"},
        {"grade": "D", "minScore": 0, "maxScore": 59, "gradePoint": 1.0, "remark": "Needs Practice", "classification": "Needs Support", "colorBadge": "bg-rose-100 text-rose-800 border-rose-300"}
    ]'::jsonb
),
(
    'PRIMARY',
    'Primary 1 - 5 (Elementary Grading Scale)',
    'Standard Nigerian National Primary Curriculum scale for Basic 1 to Basic 5.',
    '["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5"]'::jsonb,
    '[
        {"grade": "A*", "minScore": 90, "maxScore": 100, "gradePoint": 5.0, "remark": "Outstanding Academic Merit", "classification": "High Distinction", "colorBadge": "bg-purple-100 text-purple-800 border-purple-300"},
        {"grade": "A", "minScore": 80, "maxScore": 89, "gradePoint": 4.0, "remark": "Excellent Performance", "classification": "Distinction", "colorBadge": "bg-blue-100 text-blue-800 border-blue-300"},
        {"grade": "B", "minScore": 70, "maxScore": 79, "gradePoint": 3.5, "remark": "Very Good", "classification": "Upper Credit", "colorBadge": "bg-emerald-100 text-emerald-800 border-emerald-300"},
        {"grade": "C", "minScore": 60, "maxScore": 69, "gradePoint": 3.0, "remark": "Good", "classification": "Credit", "colorBadge": "bg-teal-100 text-teal-800 border-teal-300"},
        {"grade": "D", "minScore": 50, "maxScore": 59, "gradePoint": 2.0, "remark": "Fair / Average", "classification": "Pass", "colorBadge": "bg-amber-100 text-amber-800 border-amber-300"},
        {"grade": "E", "minScore": 40, "maxScore": 49, "gradePoint": 1.0, "remark": "Marginal Pass", "classification": "Weak Pass", "colorBadge": "bg-orange-100 text-orange-800 border-orange-300"},
        {"grade": "F", "minScore": 0, "maxScore": 39, "gradePoint": 0.0, "remark": "Unsatisfactory / Fail", "classification": "Fail", "colorBadge": "bg-rose-100 text-rose-800 border-rose-300"}
    ]'::jsonb
),
(
    'SECONDARY',
    'Secondary Education (WAEC & BECE 9-Point Standard Scale)',
    'Senior Secondary & Junior Secondary standard West African Examination Council assessment model.',
    '["JSS 1A", "JSS 1B", "JSS 2A", "JSS 2B", "JSS 3A", "JSS 3B", "SS 1A", "SS 1B", "SS 2A", "SS 2B", "SS 3A", "SS 3B"]'::jsonb,
    '[
        {"grade": "A1", "minScore": 75, "maxScore": 100, "gradePoint": 4.0, "remark": "Excellent", "classification": "Distinction", "colorBadge": "bg-purple-100 text-purple-800 border-purple-300"},
        {"grade": "B2", "minScore": 70, "maxScore": 74, "gradePoint": 3.5, "remark": "Very Good", "classification": "Very Good", "colorBadge": "bg-blue-100 text-blue-800 border-blue-300"},
        {"grade": "B3", "minScore": 65, "maxScore": 69, "gradePoint": 3.0, "remark": "Good", "classification": "Good", "colorBadge": "bg-teal-100 text-teal-800 border-teal-300"},
        {"grade": "C4", "minScore": 60, "maxScore": 64, "gradePoint": 2.5, "remark": "Credit", "classification": "Credit", "colorBadge": "bg-emerald-100 text-emerald-800 border-emerald-300"},
        {"grade": "C5", "minScore": 55, "maxScore": 59, "gradePoint": 2.0, "remark": "Credit", "classification": "Credit", "colorBadge": "bg-emerald-50 text-emerald-700 border-emerald-200"},
        {"grade": "C6", "minScore": 50, "maxScore": 54, "gradePoint": 1.5, "remark": "Credit", "classification": "Credit", "colorBadge": "bg-emerald-50 text-emerald-700 border-emerald-200"},
        {"grade": "D7", "minScore": 45, "maxScore": 49, "gradePoint": 1.0, "remark": "Pass", "classification": "Pass", "colorBadge": "bg-amber-100 text-amber-800 border-amber-300"},
        {"grade": "E8", "minScore": 40, "maxScore": 44, "gradePoint": 0.5, "remark": "Pass", "classification": "Pass", "colorBadge": "bg-orange-100 text-orange-800 border-orange-300"},
        {"grade": "F9", "minScore": 0, "maxScore": 39, "gradePoint": 0.0, "remark": "Fail", "classification": "Fail", "colorBadge": "bg-rose-100 text-rose-800 border-rose-300"}
    ]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
    tier_title = EXCLUDED.tier_title,
    description = EXCLUDED.description,
    applicable_classes = EXCLUDED.applicable_classes,
    brackets = EXCLUDED.brackets,
    updated_at = NOW();
