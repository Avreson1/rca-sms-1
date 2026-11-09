-- ==============================================================================
-- ROYAL CROWN ACADEMY — IDENTITY CARDS: THE PHOTOGRAPH AND WHAT THE OFFICE ADDS
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql, guardian_students.sql, operations_state.sql,
-- traits_assessments.sql, inventory.sql, timetable.sql, staff_duties.sql,
-- classes_and_subjects.sql, cbt.sql, calendar.sql and
-- ca_structure_and_bulletin.sql. It is safe to run again.
--
-- A pupil or a member of staff is already on the school's register. What was
-- missing was the card: the photograph, the framing of that photograph, the
-- serial, the validity dates and the emergency contact the gate asks for. None
-- of it had anywhere to live, so an identity card could only be made in a
-- graphics programme and re-made by hand every time a child moved class.
--
-- THE ONE RULE THIS SCHEMA ENFORCES: a card holds only what the office ADDS.
-- The name, class, house, role and designation are read from `students` and
-- `staff` every time a card is drawn, never copied in here — a copy would go on
-- printing last year's class after promotion had moved the child.
--
-- `holder_name` is the one exception, and it is a label for the filing cabinet:
-- it lets the office find and withdraw a card whose holder has since left the
-- register. The card artwork still prefers the live register row.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. THE CARD
--
-- holder_type + holder_ref is the pair the whole portal already addresses a
-- person by: an admission number for a pupil, a staff id for a member. UNIQUE,
-- so filing a card twice corrects the one already on file instead of issuing a
-- second identity for the same child.
--
-- photo is a data URL, shrunk in the browser to a 720 px long edge before it is
-- sent. It is deliberately NOT a link to a storage bucket: a bucket readable by
-- a URL is a bucket a child's photograph can be enumerated from, and this table
-- is readable only by the server's service role. The CHECK keeps anything that
-- is not a JPEG, PNG or WebP out — an SVG or an html data URL has no business in
-- a column that ends up inside an <img> tag.
--
-- photo_x / photo_y are percentages of the frame, photo_zoom a multiplier, so
-- the office can centre a face without re-cropping and re-uploading the file.
-- The same three numbers drive the preview and the print, so what the clerk
-- framed is what the laminator gets.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.id_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holder_type VARCHAR(10) NOT NULL,
    holder_ref VARCHAR(60) NOT NULL,
    holder_name VARCHAR(200) NOT NULL DEFAULT '',
    photo TEXT NOT NULL DEFAULT '',
    photo_zoom NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    photo_x NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    photo_y NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    layout VARCHAR(12) NOT NULL DEFAULT 'portrait',
    theme VARCHAR(12) NOT NULL DEFAULT 'royal',
    card_no VARCHAR(60) NOT NULL DEFAULT '',
    blood_group VARCHAR(4) NOT NULL DEFAULT '',
    -- Nullable on purpose. A school that has not decided a validity period must
    -- not be shown an expiry date somebody invented, and a card with no expiry
    -- prints the session instead.
    issued_on DATE,
    expires_on DATE,
    emergency_name VARCHAR(160) NOT NULL DEFAULT '',
    emergency_phone VARCHAR(40) NOT NULL DEFAULT '',
    back_notes TEXT NOT NULL DEFAULT '',
    show_back BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100) NOT NULL DEFAULT '',
    CONSTRAINT id_cards_holder_type_known CHECK (holder_type IN ('student', 'staff')),
    CONSTRAINT id_cards_holder_ref_present CHECK (char_length(btrim(holder_ref)) >= 1),
    CONSTRAINT id_cards_layout_known CHECK (layout IN ('portrait', 'landscape', 'badge')),
    CONSTRAINT id_cards_theme_known CHECK (theme IN ('royal', 'scarlet', 'midnight', 'paper')),
    CONSTRAINT id_cards_blood_group_known CHECK (
        blood_group IN ('', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    ),
    CONSTRAINT id_cards_photo_is_image CHECK (
        photo = '' OR photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
    ),
    CONSTRAINT id_cards_photo_size CHECK (char_length(photo) <= 300000),
    CONSTRAINT id_cards_zoom_range CHECK (photo_zoom >= 1.00 AND photo_zoom <= 3.00),
    CONSTRAINT id_cards_offset_range CHECK (
        photo_x >= -50.0 AND photo_x <= 50.0 AND photo_y >= -50.0 AND photo_y <= 50.0
    ),
    CONSTRAINT id_cards_validity_order CHECK (
        issued_on IS NULL OR expires_on IS NULL OR expires_on > issued_on
    ),
    CONSTRAINT id_cards_holder_unique UNIQUE (holder_type, holder_ref)
);

CREATE INDEX IF NOT EXISTS idx_id_cards_holder_type ON public.id_cards(holder_type);
CREATE INDEX IF NOT EXISTS idx_id_cards_updated ON public.id_cards(updated_at DESC);

ALTER TABLE public.id_cards ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. THE INDEX THE CARD LIST READS
--
-- Three hundred photographs at 120 kB each is 36 MB. A list of cards must not
-- carry them: the office looking to see who still needs a card would download
-- the whole school's pictures to do it. This view is that list with the
-- photograph left behind and only the fact of it — has_photo, photo_chars —
-- brought through. The card itself is read from the table, one holder at a time.
--
-- The view runs with its owner's rights, so the REVOKE below is load-bearing
-- rather than a formality: without it a view is the one door through which the
-- browser's anon key could read a whole table while every other table in this
-- folder stays shut.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.id_card_index AS
SELECT
    id,
    holder_type,
    holder_ref,
    holder_name,
    photo_zoom,
    photo_x,
    photo_y,
    layout,
    theme,
    card_no,
    blood_group,
    issued_on,
    expires_on,
    emergency_name,
    emergency_phone,
    back_notes,
    show_back,
    created_at,
    updated_at,
    updated_by,
    (photo <> '') AS has_photo,
    char_length(photo) AS photo_chars
FROM public.id_cards;

-- ------------------------------------------------------------------------------
-- Grants. Service-role traffic bypasses row security, but a table still has to be
-- granted to the role that touches it; on a project created before this table
-- existed the grants can be missing and the portal then reports "permission
-- denied for table …". The grants follow the role, so rotating a key needs none
-- of this re-run.
--
-- The REVOKE is load-bearing: without it the browser's anon key could read every
-- photograph in the school through the REST endpoint. No policy is added for
-- anon or authenticated, so even with a grant they would read nothing — the
-- revoke makes that explicit rather than incidental.
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.id_cards TO service_role;
GRANT SELECT ON public.id_card_index TO service_role;

REVOKE ALL ON public.id_cards FROM anon, authenticated;
REVOKE ALL ON public.id_card_index FROM anon, authenticated;

-- ==============================================================================
-- Check it worked:
--
--   SELECT count(*) FROM public.id_cards;                 -- 0 until a card is filed
--   SELECT holder_type, holder_ref, layout, theme, has_photo, photo_chars
--   FROM public.id_card_index ORDER BY updated_at DESC;   -- empty, not an error
--
-- Then file one card from Operations → ID Cards and read the second line again:
-- photo_chars should be roughly 80,000–160,000 for a photograph and has_photo
-- true; a card filed without one shows 0 and false. Neither line may be readable
-- with the publishable key:
--
--   SELECT count(*) FROM public.id_card_index;            -- as anon → permission denied
--
-- Withdrawing a card whose holder has left the register:
--
--   DELETE FROM public.id_cards WHERE holder_type = 'student' AND holder_ref = '…';
-- ==============================================================================