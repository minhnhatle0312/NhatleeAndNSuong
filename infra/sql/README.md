# SQL Server schema

For a fresh SQL Server or Azure SQL database, apply `001-initial-schema.sql`. It creates the `memory` schema, tables required by the current APIs, indexes, and starter event categories. The migration is safe to reapply: existing tables are left in place.

The app expects `Media`, `ChatMessage`, `LocationPing`, `EventCategory`, `AnniversaryEvent`, `SharedWish`, `SharedEntry`, and `SharedSetting` tables. Uploaded image/video binaries remain in the persistent `uploads/` volume; SQL stores their metadata and paths.

If you already have a database with tables created from an older/custom script, compare its columns with the migration before applying schema changes. Back up existing data first.
