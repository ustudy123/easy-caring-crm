-- Corrige erro ao revogar permissões de usuários:
-- "update or delete on table sellers violates foreign key constraint ... on table follow_ups"
--
-- Causa: ao revogar, a função admin_revoke_user_role faz DELETE FROM sellers,
-- mas várias tabelas referenciam sellers(id) com ON DELETE padrão (RESTRICT),
-- bloqueando a exclusão.
--
-- Solução: recria TODAS as foreign keys que referenciam public.sellers como
-- ON DELETE SET NULL. Assim a exclusão do vendedor zera as referências e
-- preserva o histórico (follow-ups, leads, transferências, etc. ficam sem vendedor).

DO $$
DECLARE
  r RECORD;
  newdef text;
BEGIN
  FOR r IN
    SELECT con.conname AS name,
           con.conrelid::regclass::text AS tbl,
           pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.sellers'::regclass
  LOOP
    -- Já está como SET NULL? não mexe.
    IF position('ON DELETE SET NULL' IN r.def) > 0 THEN
      CONTINUE;
    END IF;

    -- Remove qualquer cláusula ON DELETE existente e força ON DELETE SET NULL.
    newdef := regexp_replace(
      r.def,
      ' ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)',
      '', 'g'
    );

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.name);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON DELETE SET NULL', r.tbl, r.name, newdef);

    RAISE NOTICE 'FK % em % recriada como ON DELETE SET NULL', r.name, r.tbl;
  END LOOP;
END $$;
