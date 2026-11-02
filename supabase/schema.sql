-- ==============================================================================
-- PROYECTO KAIROS: ESQUEMA OFICIAL DE BASE DE DATOS (SUPABASE / POSTGRESQL)
-- Arquitectura de Alto Rendimiento, Mínimo Consumo de Almacenamiento y Cero Caídas
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA PRINCIPAL DE USUARIOS Y DATOS ATÓMICOS
CREATE TABLE IF NOT EXISTS public.kairos_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    profile JSONB DEFAULT NULL,
    routine JSONB DEFAULT NULL,
    sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    audio_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    active_workout JSONB DEFAULT NULL
);

-- 3. ALMACENAMIENTO COMPRIMIDO (TOAST Compression)
-- Optimiza la huella en disco: PostgreSQL comprime automáticamente los JSONB
ALTER TABLE public.kairos_users ALTER COLUMN sessions SET STORAGE EXTENDED;
ALTER TABLE public.kairos_users ALTER COLUMN routine SET STORAGE EXTENDED;
ALTER TABLE public.kairos_users ALTER COLUMN profile SET STORAGE EXTENDED;

-- 4. ÍNDICES DE ALTO RENDIMIENTO
CREATE UNIQUE INDEX IF NOT EXISTS idx_kairos_users_lower_username 
    ON public.kairos_users (LOWER(username));

CREATE INDEX IF NOT EXISTS idx_kairos_users_created_at 
    ON public.kairos_users (created_at DESC);

-- 5. TRIGGER AUTOMÁTICO PARA updated_at
CREATE OR REPLACE FUNCTION public.handle_kairos_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kairos_users_updated_at ON public.kairos_users;
CREATE TRIGGER trg_kairos_users_updated_at
    BEFORE UPDATE ON public.kairos_users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_kairos_user_updated_at();

-- 6. SEGURIDAD A NIVEL DE FILAS (Row Level Security - RLS)
ALTER TABLE public.kairos_users ENABLE ROW LEVEL SECURITY;

-- Política de acceso para el Backend de Next.js (Service Role Key tiene acceso total de servidor)
-- Para máxima compatibilidad en caso de usar anon key en entornos controlados:
DROP POLICY IF EXISTS "kairos_server_all_access" ON public.kairos_users;
CREATE POLICY "kairos_server_all_access" 
    ON public.kairos_users 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Comentarios explicativos para el catálogo
COMMENT ON TABLE public.kairos_users IS 'KAIROS iOS PWA: Base de datos centralizada de usuarios, rutinas, perfiles antropométricos e historiales de entrenamiento compactados.';
