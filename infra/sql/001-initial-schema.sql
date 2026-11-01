/* Initial schema for the Memory Space SQL Server database. Safe to apply more than once. */
IF SCHEMA_ID(N'memory') IS NULL EXEC(N'CREATE SCHEMA memory');
GO
IF OBJECT_ID(N'memory.Media', N'U') IS NULL
BEGIN
  CREATE TABLE memory.Media (
    MediaId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Media PRIMARY KEY,
    Title NVARCHAR(70) NULL,
    Caption NVARCHAR(300) NULL,
    MemoryDate DATE NULL,
    MediaType VARCHAR(10) NOT NULL CONSTRAINT CK_Media_MediaType CHECK (MediaType IN ('image','video')),
    RelativePath NVARCHAR(500) NOT NULL,
    OriginalFileName NVARCHAR(255) NULL,
    FileSizeBytes BIGINT NULL,
    IsFavorite BIT NOT NULL CONSTRAINT DF_Media_IsFavorite DEFAULT (0),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Media_CreatedAt DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_Media_MemoryDate ON memory.Media(MemoryDate DESC, CreatedAt DESC);
END;
GO
IF OBJECT_ID(N'memory.ChatMessage', N'U') IS NULL
BEGIN
  CREATE TABLE memory.ChatMessage (
    MessageId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChatMessage PRIMARY KEY,
    Sender NVARCHAR(24) NOT NULL,
    Message NVARCHAR(500) NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ChatMessage_CreatedAt DEFAULT (SYSUTCDATETIME()),
    IsPinned BIT NOT NULL CONSTRAINT DF_ChatMessage_IsPinned DEFAULT (0)
  );
END;
GO
IF OBJECT_ID(N'memory.LocationPing', N'U') IS NULL
BEGIN
  CREATE TABLE memory.LocationPing (
    LocationPingId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LocationPing PRIMARY KEY,
    UserName NVARCHAR(24) NOT NULL,
    Latitude DECIMAL(9,6) NOT NULL,
    Longitude DECIMAL(9,6) NOT NULL,
    AccuracyMeters INT NULL,
    RecordedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LocationPing_RecordedAt DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_LocationPing_UserDate ON memory.LocationPing(UserName, RecordedAt DESC);
END;
GO
IF OBJECT_ID(N'memory.EventCategory', N'U') IS NULL
BEGIN
  CREATE TABLE memory.EventCategory (
    CategoryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventCategory PRIMARY KEY DEFAULT (NEWID()),
    CategoryName NVARCHAR(60) NOT NULL,
    Icon NVARCHAR(16) NOT NULL,
    Color VARCHAR(20) NOT NULL
  );
END;
GO
IF OBJECT_ID(N'memory.AnniversaryEvent', N'U') IS NULL
BEGIN
  CREATE TABLE memory.AnniversaryEvent (
    EventId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AnniversaryEvent PRIMARY KEY DEFAULT (NEWID()),
    Title NVARCHAR(150) NOT NULL,
    EventDate DATE NOT NULL,
    CategoryId UNIQUEIDENTIFIER NULL,
    IsRecurring BIT NOT NULL CONSTRAINT DF_AnniversaryEvent_IsRecurring DEFAULT (0),
    RecurringType NVARCHAR(20) NULL,
    ImportanceLevel INT NOT NULL CONSTRAINT DF_AnniversaryEvent_Importance DEFAULT (1),
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AnniversaryEvent_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_AnniversaryEvent_Category FOREIGN KEY (CategoryId) REFERENCES memory.EventCategory(CategoryId)
  );
END;
GO
IF OBJECT_ID(N'memory.SharedWish', N'U') IS NULL
BEGIN
  CREATE TABLE memory.SharedWish (
    WishId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SharedWish PRIMARY KEY DEFAULT (NEWID()),
    WishText NVARCHAR(200) NOT NULL,
    IsCompleted BIT NOT NULL CONSTRAINT DF_SharedWish_IsCompleted DEFAULT (0),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SharedWish_CreatedAt DEFAULT (SYSUTCDATETIME())
  );
END;
GO
IF OBJECT_ID(N'memory.SharedEntry', N'U') IS NULL
BEGIN
  CREATE TABLE memory.SharedEntry (
    EntryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SharedEntry PRIMARY KEY DEFAULT (NEWID()),
    EntryType VARCHAR(16) NOT NULL CONSTRAINT CK_SharedEntry_Type CHECK (EntryType IN ('journal','gift','challenge','expense','mood','capsule','place')),
    Title NVARCHAR(150) NOT NULL,
    Body NVARCHAR(3000) NULL,
    Mood NVARCHAR(24) NULL,
    Amount DECIMAL(12,2) NULL,
    TargetDate DATE NULL,
    IsCompleted BIT NOT NULL CONSTRAINT DF_SharedEntry_IsCompleted DEFAULT (0),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SharedEntry_CreatedAt DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_SharedEntry_TypeDate ON memory.SharedEntry(EntryType, TargetDate DESC, CreatedAt DESC);
END;
GO
IF OBJECT_ID(N'memory.SharedSetting', N'U') IS NULL
BEGIN
  CREATE TABLE memory.SharedSetting (
    SettingKey NVARCHAR(50) NOT NULL CONSTRAINT PK_SharedSetting PRIMARY KEY,
    SettingValue NVARCHAR(4000) NOT NULL,
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SharedSetting_UpdatedAt DEFAULT (SYSUTCDATETIME())
  );
END;
GO
IF NOT EXISTS (SELECT 1 FROM memory.SharedSetting WHERE SettingKey = N'relationshipStart')
  INSERT INTO memory.SharedSetting (SettingKey, SettingValue) VALUES (N'relationshipStart', N'2025-05-08');
GO
IF NOT EXISTS (SELECT 1 FROM memory.EventCategory)
BEGIN
  INSERT INTO memory.EventCategory (CategoryName, Icon, Color) VALUES
    (N'Tình yêu', N'❤️', '#ff4d4f'), (N'Gia đình', N'🏡', '#1890ff'),
    (N'Bạn bè', N'🤝', '#52c41a'), (N'Công việc', N'💼', '#faad14'),
    (N'Học tập', N'📚', '#722ed1'), (N'Khác', N'📌', '#8c8c8c');
END;
GO
