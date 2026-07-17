BEGIN;

CREATE INDEX IF NOT EXISTS offers_owner_user_id_idx
  ON public.offers USING btree (owner_user_id);

CREATE INDEX IF NOT EXISTS offer_activity_actor_user_id_idx
  ON public.offer_activity USING btree (actor_user_id);

COMMIT;
