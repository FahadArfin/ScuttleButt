# ADR-0007: S3-compatible object storage

- Status: Accepted for implementation, subject to Phase 4 attachment tests
- Date: 2026-08-02

## Context

Media and attachments can be large, need thumbnails and policy-controlled limits, and should not make PostgreSQL the blob store. Development should be easy to run locally; production operators should be able to choose their storage provider.

## Decision

Use an S3-compatible object-storage interface. Use MinIO in local development and document external S3-compatible storage for production. PostgreSQL stores attachment metadata, policy, ownership, and cleanup state—not large binary content.

Use private buckets, opaque object keys, short-lived signed URLs, MIME/size validation, upload quotas, and cleanup jobs. Encrypt attachment bytes client-side before storage for encrypted rooms. Never treat an object-storage URL as a decryption key.

## Alternatives considered

- Local filesystem: easy for one server, but weak for scaling, backups, and portability.
- PostgreSQL large objects: operationally coupled and expensive for media-heavy workloads.
- A single hosted media provider: violates the self-hosted default and creates unnecessary lock-in.

## Consequences

Storage policy becomes an operator responsibility. Encrypted attachments cannot be server-scanned for malware or content moderation without intentionally crossing the E2EE boundary; unencrypted upload paths need their own scanning and abuse controls.
