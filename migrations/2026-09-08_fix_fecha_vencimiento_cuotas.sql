-- Migración de datos (no de esquema): corrige `fechaVencimiento` en planes
-- de cuotas creados con un bug de zona horaria del frontend.
--
-- Bug: al crear un plan, el frontend guardaba `fechaVencimiento` a las
-- 23:59:59.999 hora LOCAL del navegador antes de convertir a UTC. En zonas
-- detrás de UTC (p. ej. America/Guatemala, UTC-6) eso empuja el dato al día
-- de calendario SIGUIENTE en UTC (28 mar 23:59:59 local -> 29 mar 05:59:59
-- UTC), y la app muestra la fecha leyendo los dígitos UTC directamente, así
-- que se veía "29 de marzo" en vez de "28 de marzo".
--
-- Ya corregido en el código (Quantis-Frontend/src/pages/Dashboard.jsx y
-- src/pages/components/GastosContent.jsx usan ahora mediodía local en vez
-- de 23:59:59.999), así que esto no vuelve a pasar para planes nuevos.
-- Este script corrige solo los datos que ya quedaron guardados mal.
--
-- Uso (una sola vez, contra producción):
--   psql "$DATABASE_URL" -f migrations/2026-09-08_fix_fecha_vencimiento_cuotas.sql
--
-- Es idempotente: se puede correr más de una vez sin efecto adicional —
-- solo toca filas cuya fechaVencimiento no coincide con el cálculo
-- correcto a partir de fechaInicio + cuotasTotal + frecuenciaPago.
--
-- Nota: usa funciones pg_temp (viven solo durante esta sesión de psql) para
-- no dejar nada permanente en el esquema.

BEGIN;

-- Suma "meses" a "base" replicando el desbordamiento de día que hace
-- JavaScript (Date.UTC / setMonth): si el día no existe en el mes destino,
-- se desborda hacia el mes siguiente en vez de recortarse al último día
-- (a diferencia de `date + interval 'n months'` de Postgres, que sí
-- recorta). Debe coincidir con calcularProximaFecha() en
-- Quantis-Backend/utils/fechaUtils.js y
-- Quantis-Frontend/src/utils/cuotaFechaUtils.js (rama sin diaPago).
CREATE OR REPLACE FUNCTION pg_temp.quantis_add_months_js(base date, meses int)
RETURNS date AS $$
DECLARE
  y int := extract(year FROM base)::int;
  m0 int := extract(month FROM base)::int - 1; -- 0-indexado como en JS
  d int := extract(day FROM base)::int;
  total_m int := y * 12 + m0 + meses;
  new_y int := total_m / 12;
  new_m0 int := total_m % 12;
BEGIN
  RETURN (make_date(new_y, new_m0 + 1, 1) + (d - 1) * interval '1 day')::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Un avance de "una cuota" según frecuencia (equivalente a
-- calcularProximaFecha(cursor, frecuencia) sin diaPago explícito).
CREATE OR REPLACE FUNCTION pg_temp.quantis_avanzar(base date, frecuencia text)
RETURNS date AS $$
BEGIN
  RETURN CASE frecuencia
    WHEN 'diario' THEN base + 1
    WHEN 'semanal' THEN base + 7
    WHEN 'quincenal' THEN base + 15
    WHEN 'trimestral' THEN pg_temp.quantis_add_months_js(base, 3)
    WHEN 'anual' THEN pg_temp.quantis_add_months_js(base, 12)
    ELSE pg_temp.quantis_add_months_js(base, 1) -- 'mensual' y cualquier otro valor
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fecha de la última cuota: fechaInicio + (cuotasTotal - 1) avances,
-- iterando igual que fechaUltimaCuotaDesdePrimera() en el frontend (cada
-- avance parte de la fecha ya desplazada, no siempre de fechaInicio, para
-- reproducir el mismo drift que produce la app en meses cortos).
CREATE OR REPLACE FUNCTION pg_temp.quantis_fecha_ultima_cuota(
  fecha_inicio date, cuotas_total int, frecuencia text
) RETURNS date AS $$
DECLARE
  cursor_fecha date := fecha_inicio;
  i int;
  total int := GREATEST(COALESCE(cuotas_total, 1), 1);
BEGIN
  FOR i IN 1..(total - 1) LOOP
    cursor_fecha := pg_temp.quantis_avanzar(cursor_fecha, COALESCE(frecuencia, 'mensual'));
  END LOOP;
  RETURN cursor_fecha;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vista previa de lo que se va a corregir (revisa esto en el output antes
-- de que corra el UPDATE de abajo).
SELECT
  id,
  nombre,
  "fechaVencimiento"::date AS actual,
  pg_temp.quantis_fecha_ultima_cuota("fechaInicio"::date, "cuotasTotal", "frecuenciaPago") AS correcta
FROM cuotas
WHERE "fechaVencimiento"::date <>
      pg_temp.quantis_fecha_ultima_cuota("fechaInicio"::date, "cuotasTotal", "frecuenciaPago");

-- Corrección: se guarda a las 12:00:00 UTC (mediodía), coherente con la
-- nueva convención del frontend (evita la ambigüedad de día por zona
-- horaria que causó el bug original).
UPDATE cuotas
SET "fechaVencimiento" =
      pg_temp.quantis_fecha_ultima_cuota("fechaInicio"::date, "cuotasTotal", "frecuenciaPago")
      + interval '12 hours'
WHERE "fechaVencimiento"::date <>
      pg_temp.quantis_fecha_ultima_cuota("fechaInicio"::date, "cuotasTotal", "frecuenciaPago");

COMMIT;
