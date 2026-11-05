-- ==============================================================================
-- ROYAL CROWN ACADEMY — INVENTORY: THE STORES LEDGER AND ITS MOVEMENT LOG
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql, guardian_students.sql, operations_state.sql and
-- traits_assessments.sql. It is safe to run again.
--
-- A school buys things, keeps them in rooms, lends them out and loses them. None
-- of that was recorded anywhere in this portal: the only list of property was
-- whatever a person had typed into their own spreadsheet. When the office needed
-- to know how many chairs are in the hall, or who has the second laptop, there
-- was no answer to find — so the answer invented was the one written down.
--
-- THE ONE RULE THIS SCHEMA ENFORCES: a quantity is never stored as a fact and
-- then quietly edited. What is on the shelf is the opening figure plus every
-- receipt minus every issue, and the movement log is the only way to change it.
-- A ledger whose total can be retyped by hand is not evidence — it is an
-- opinion. So `inventory_items` holds an OPENING quantity, and the stock figure
-- the screens print comes from the view below, which adds up the log every time.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. THE REGISTER: WHAT THE SCHOOL OWNS
--
-- asset_ref is the painted label or the invoice number the item is known by. It
-- is UNIQUE but nullable, and the API turns an empty string into NULL — two
-- items whose keeper left the field blank must not collide into one rejected
-- save, which is how a register gets abandoned in the middle of a term.
--
-- acquired_on and purchase_value are nullable on purpose. "We never wrote down
-- what the desk cost" is a real fact about a school's property, and a NOT NULL
-- column would force somebody to type 0 — which every later reader would take
-- for a free desk.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_ref VARCHAR(60) UNIQUE,
    item_name VARCHAR(200) NOT NULL CHECK (char_length(btrim(item_name)) >= 2),
    category VARCHAR(80) NOT NULL DEFAULT 'General Stores',
    unit VARCHAR(40) NOT NULL DEFAULT 'piece',
    opening_quantity INT NOT NULL DEFAULT 0 CHECK (opening_quantity >= 0),
    location VARCHAR(120) NOT NULL DEFAULT '',
    custodian VARCHAR(120) NOT NULL DEFAULT '',
    condition VARCHAR(40) NOT NULL DEFAULT 'Good',
    acquired_on DATE,
    purchase_value NUMERIC(14, 2),
    -- The quantity the store keeper wants on the shelf before ordering more.
    -- Nullable: a school that has never set one must not be shown a "low stock"
    -- warning invented from a default, and an item genuinely has no reorder point
    -- when it is not bought again.
    reorder_level INT CHECK (reorder_level IS NULL OR reorder_level >= 0),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    CONSTRAINT inventory_items_condition_known CHECK (
        condition IN ('New', 'Good', 'Fair', 'Poor', 'Damaged', 'Unusable', 'Lost', 'Disposed')
    )
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON public.inventory_items(location);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. THE MOVEMENT LOG: EVERYTHING IN AND OUT
--
-- One row per physical act: goods received, an item issued to a member of staff
-- or a class, a return, or stock written off. quantity is always positive — the
-- direction column says which way it moved, so a "return of -4" cannot hide in
-- the log and double-count.
--
-- party and purpose are what make the log worth reading in two years: not that
-- four reams left the store, that the Primary 3 art lesson took them on the 12th
-- and Mrs Okon was the one who signed for them.
--
-- recorded_by is filled by the API from the signed-in session, never from the
-- request body — otherwise a person could file a movement under a colleague's
-- name.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    direction VARCHAR(4) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    party VARCHAR(160) NOT NULL DEFAULT '',
    purpose VARCHAR(200) NOT NULL DEFAULT '',
    moved_on DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_movements_direction_known CHECK (direction IN ('in', 'out'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON public.inventory_movements(moved_on DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. THE STOCK VIEW
--
-- quantity_on_hand is computed, never stored, so it cannot disagree with the log
-- that produced it. The register screen and every report read this view.
--
-- The view runs with its owner's rights, which is why the REVOKE below is
-- load-bearing rather than a formality: without it, a view is the one door
-- through which the browser's anon key could read a whole table while every
-- other table in this folder stays shut. The portal's API routes are the only
-- readers, and they check the signed-in role first.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.inventory_stock AS
SELECT
    i.id,
    i.asset_ref,
    i.item_name,
    i.category,
    i.unit,
    i.opening_quantity,
    i.location,
    i.custodian,
    i.condition,
    i.acquired_on,
    i.purchase_value,
    i.reorder_level,
    i.notes,
    i.created_at,
    i.updated_at,
    i.created_by,
    COALESCE(m.quantity_in, 0)::INT  AS quantity_in,
    COALESCE(m.quantity_out, 0)::INT AS quantity_out,
    (i.opening_quantity + COALESCE(m.quantity_in, 0) - COALESCE(m.quantity_out, 0))::INT AS quantity_on_hand
FROM public.inventory_items i
LEFT JOIN (
    SELECT
        item_id,
        SUM(quantity) FILTER (WHERE direction = 'in')  AS quantity_in,
        SUM(quantity) FILTER (WHERE direction = 'out') AS quantity_out
    FROM public.inventory_movements
    GROUP BY item_id
) m ON m.item_id = i.id;

-- ------------------------------------------------------------------------------
-- Grants. Service-role traffic bypasses row security, but a table still has to be
-- granted to the role that touches it; on a project created before these tables
-- existed the grants can be missing and the portal then reports "permission
-- denied for table …". The grants follow the role, so rotating a key needs none
-- of this re-run.
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO service_role;
GRANT SELECT ON public.inventory_stock TO service_role;

REVOKE ALL ON public.inventory_items FROM anon, authenticated;
REVOKE ALL ON public.inventory_movements FROM anon, authenticated;
REVOKE ALL ON public.inventory_stock FROM anon, authenticated;

-- ==============================================================================
-- Check it worked:
--
--   SELECT count(*) FROM public.inventory_items;            -- 0 until an item is filed
--   SELECT count(*) FROM public.inventory_movements;        -- 0 until stock moves
--   SELECT item_name, quantity_on_hand FROM public.inventory_stock;   -- empty, not an error
--
-- Then file one item and one issue against it and read the same three lines:
-- quantity_on_hand must have gone down by exactly the issued quantity. If it has
-- not, the view is not seeing the log.
--
-- Nothing here holds a child's data, so no guardian link applies: a Student /
-- Parent login is refused the whole ledger at /api/inventory, and it is not
-- listed in the family's navigation.
-- ==============================================================================
