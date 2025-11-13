-- Migration: Add Composite Device ID Columns
-- Feature: 004-tutto-troppo-complicato
-- Date: 2025-11-12
-- Description: Adds project_id, device_number, and composite_device_id columns to devices and device_heartbeats

-- Add new columns to devices table (nullable during migration phases)
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS composite_device_id TEXT,
ADD COLUMN IF NOT EXISTS project_id TEXT,
ADD COLUMN IF NOT EXISTS device_number INTEGER;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_devices_composite_id ON devices(composite_device_id);
CREATE INDEX IF NOT EXISTS idx_devices_project_device_number ON devices(project_id, device_number);

-- Add foreign key to projects (nullable for now to support legacy devices)
-- Will be enforced in Phase 3 when all devices are migrated
ALTER TABLE devices
ADD CONSTRAINT fk_devices_project_id
FOREIGN KEY (project_id)
REFERENCES projects(project_id)
ON DELETE CASCADE
NOT VALID;

-- Add composite_device_id to heartbeats for denormalized lookup
ALTER TABLE device_heartbeats
ADD COLUMN IF NOT EXISTS composite_device_id TEXT;

-- Create index for efficient heartbeat queries
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_composite_id ON device_heartbeats(composite_device_id, ts DESC);

-- Add comments
COMMENT ON COLUMN devices.composite_device_id IS 'Combined ID in format PROJ1-ESP5';
COMMENT ON COLUMN devices.project_id IS 'References projects.project_id (e.g., PROJ1)';
COMMENT ON COLUMN devices.device_number IS 'Device number within project (1-20)';
COMMENT ON COLUMN device_heartbeats.composite_device_id IS 'Denormalized composite ID for efficient queries';
