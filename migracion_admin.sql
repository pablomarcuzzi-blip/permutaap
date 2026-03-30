    -- Migración: Agregar sistema de administradores
-- Fecha: 2026-03-13

-- 1. Agregar columna es_admin a tabla usuarios
ALTER TABLE usuarios ADD COLUMN es_admin INTEGER DEFAULT 0;

-- 2. Hacer admin a pablo.marcuzzi@bue.edu.ar (actualizar si existe, o insertar si no)
-- Nota: Esto se hará con un script de Node.js, no directamente aquí

-- 3. Crear índice para búsquedas rápidas de admin
CREATE INDEX IF NOT EXISTS idx_usuarios_admin ON usuarios(es_admin);