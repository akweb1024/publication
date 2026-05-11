-- Add SUBSCRIBER as a first-class journal role entitlement
ALTER TYPE "JournalRole" ADD VALUE IF NOT EXISTS 'SUBSCRIBER';
