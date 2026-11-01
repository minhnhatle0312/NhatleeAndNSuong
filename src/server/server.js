require("dotenv").config();
const path = require("path"),
  fs = require("fs"),
  util = require("util"),
  express = require("express"),
  multer = require("multer"),
  http = require("http"),
  { Server } = require("socket.io");
const sql =
  process.env.SQL_AUTH === "sql"
    ? require("mssql")
    : require("mssql/msnodesqlv8");
const app = express(),
  server = http.createServer(app),
  io = new Server(server),
  port = Number(process.env.PORT || 3000),
  projectRoot = path.resolve(__dirname, "../.."),
  publicDir = path.join(projectRoot, "public"),
  uploads = path.join(projectRoot, "uploads");
fs.mkdirSync(uploads, { recursive: true });
const dbName = process.env.SQL_DATABASE || "NhatLeeNSuongMemories";
const config =
  process.env.SQL_AUTH === "sql"
    ? {
        server: process.env.SQL_SERVER || "localhost",
        database: dbName,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        options: {
          encrypt: process.env.SQL_ENCRYPT !== "false",
          trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === "true",
        },
        port: Number(process.env.SQL_PORT || 1433),
        connectionTimeout: 15000,
        requestTimeout: 30000,
      }
    : {
        server: process.env.SQL_SERVER || "NHATLEE",
        database: dbName,
        driver: "msnodesqlv8",
        options: { trustedConnection: true, trustServerCertificate: true },
      };
let pool;
const mapMedia = (row) => ({
  _id: String(row.MediaId),
  title: row.Title,
  caption: row.Caption,
  date: row.MemoryDate,
  type: row.MediaType,
  url: row.RelativePath,
  isFavorite: row.IsFavorite,
  createdAt: row.CreatedAt,
});
const mapMessage = (row) => ({
  _id: String(row.MessageId),
  sender: row.Sender,
  text: row.Message,
  createdAt: row.CreatedAt,
  isPinned: row.IsPinned,
});
const mapLocation = (row) => ({
  userName: row.UserName,
  latitude: Number(row.Latitude),
  longitude: Number(row.Longitude),
  accuracy: row.AccuracyMeters,
  updatedAt: row.RecordedAt,
});
const upload = multer({
  storage: multer.diskStorage({
    destination: uploads,
    filename: (_, f, done) =>
      done(
        null,
        `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(f.originalname)}`,
      ),
  }),
  fileFilter: (_, f, done) => done(null, /^(image|video)\//.test(f.mimetype)),
  limits: { fileSize: 50 * 1024 * 1024 },
});
app.use(express.json());
app.use(express.static(publicDir));
app.get("/", (_, res) => res.sendFile(path.join(publicDir, "index.html")));
app.use("/uploads", express.static(uploads));
app.get("/api/health", async (_, res) => {
  try {
    await pool.request().query("SELECT 1 AS connected");
    res.json({ database: "sqlserver", connected: true });
  } catch (error) {
    res
      .status(503)
      .json({ database: "sqlserver", connected: false, error: error.message });
  }
});
app.get("/api/memories", async (_, res, next) => {
  try {
    const result = await pool
      .request()
      .query(
        "SELECT MediaId,Title,Caption,MemoryDate,MediaType,RelativePath,IsFavorite,CreatedAt FROM memory.Media ORDER BY MemoryDate DESC, CreatedAt DESC",
      );
    res.json(result.recordset.map(mapMedia));
  } catch (error) {
    next(error);
  }
});
app.post("/api/memories", upload.single("media"), async (req, res, next) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "Hãy chọn ảnh hoặc video hợp lệ" });
    const type = req.file.mimetype.startsWith("video/") ? "video" : "image";
    const result = await pool
      .request()
      .input("title", sql.NVarChar(70), req.body.title || null)
      .input("caption", sql.NVarChar(300), req.body.caption || null)
      .input("date", sql.Date, req.body.date || null)
      .input("type", sql.VarChar(10), type)
      .input("path", sql.NVarChar(500), `/uploads/${req.file.filename}`)
      .input("name", sql.NVarChar(255), req.file.originalname)
      .input("size", sql.BigInt, req.file.size)
      .query(
        "INSERT INTO memory.Media (Title,Caption,MemoryDate,MediaType,RelativePath,OriginalFileName,FileSizeBytes) OUTPUT inserted.MediaId,inserted.Title,inserted.Caption,inserted.MemoryDate,inserted.MediaType,inserted.RelativePath,inserted.IsFavorite,inserted.CreatedAt VALUES (@title,@caption,@date,@type,@path,@name,@size)",
      );
    res.status(201).json(mapMedia(result.recordset[0]));
  } catch (error) {
    next(error);
  }
});
app.get("/api/messages", async (_, res, next) => {
  try {
    const result = await pool
      .request()
      .query(
        "SELECT TOP 100 MessageId,Sender,Message,CreatedAt,IsPinned FROM memory.ChatMessage ORDER BY CreatedAt ASC",
      );
    res.json(result.recordset.map(mapMessage));
  } catch (error) {
    next(error);
  }
});
async function saveMessage(data) {
  const result = await pool
    .request()
    .input(
      "sender",
      sql.NVarChar(24),
      String(data.sender || "Người thương").trim(),
    )
    .input("text", sql.NVarChar(500), String(data.text || "").trim())
    .query(
      "INSERT INTO memory.ChatMessage (Sender,Message) OUTPUT inserted.MessageId,inserted.Sender,inserted.Message,inserted.CreatedAt,inserted.IsPinned VALUES (@sender,@text)",
    );
  return mapMessage(result.recordset[0]);
}
app.post("/api/messages", async (req, res, next) => {
  try {
    res.status(201).json(await saveMessage(req.body));
  } catch (error) {
    next(error);
  }
});
async function saveLocation(data) {
  const latitude = Number(data.latitude),
    longitude = Number(data.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    throw new Error("Vị trí không hợp lệ");
  const result = await pool
    .request()
    .input(
      "user",
      sql.NVarChar(24),
      String(data.userName || "Người thương").trim(),
    )
    .input("lat", sql.Decimal(9, 6), latitude)
    .input("lng", sql.Decimal(9, 6), longitude)
    .input("accuracy", sql.Int, Math.round(Number(data.accuracy) || 0))
    .query(
      "INSERT INTO memory.LocationPing (UserName,Latitude,Longitude,AccuracyMeters) OUTPUT inserted.UserName,inserted.Latitude,inserted.Longitude,inserted.AccuracyMeters,inserted.RecordedAt VALUES (@user,@lat,@lng,@accuracy)",
    );
  return mapLocation(result.recordset[0]);
}
app.get("/api/locations", async (_, res, next) => {
  try {
    const result = await pool
      .request()
      .query(
        "WITH latest AS (SELECT UserName,Latitude,Longitude,AccuracyMeters,RecordedAt,ROW_NUMBER() OVER (PARTITION BY UserName ORDER BY RecordedAt DESC) AS row_num FROM memory.LocationPing) SELECT UserName,Latitude,Longitude,AccuracyMeters,RecordedAt FROM latest WHERE row_num=1 ORDER BY UserName",
      );
    res.json(result.recordset.map(mapLocation));
  } catch (error) {
    next(error);
  }
});
app.post("/api/locations", async (req, res, next) => {
  try {
    res.status(201).json(await saveLocation(req.body));
  } catch (error) {
    next(error);
  }
});

// Anniversary API
app.get("/api/categories", async (_, res, next) => {
  try {
    const result = await pool
      .request()
      .query(
        "SELECT CategoryId, CategoryName, Icon, Color FROM memory.EventCategory",
      );
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});
app.get("/api/events", async (_, res, next) => {
  try {
    const result = await pool
      .request()
      .query(
        "SELECT EventId, Title, EventDate, CategoryId, IsRecurring, RecurringType, ImportanceLevel, Notes FROM memory.AnniversaryEvent ORDER BY EventDate ASC",
      );
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});
app.post("/api/events", async (req, res, next) => {
  try {
    const {
      title,
      eventDate,
      categoryId,
      isRecurring,
      recurringType,
      importanceLevel,
      notes,
    } = req.body;
    const result = await pool
      .request()
      .input("title", sql.NVarChar(150), title)
      .input("date", sql.Date, eventDate)
      .input("cat", sql.UniqueIdentifier, categoryId)
      .input("recur", sql.Bit, isRecurring ? 1 : 0)
      .input("recurType", sql.NVarChar(20), recurringType)
      .input("importance", sql.Int, importanceLevel || 1)
      .input("notes", sql.NVarChar(sql.MAX), notes)
      .query(
        "INSERT INTO memory.AnniversaryEvent (Title, EventDate, CategoryId, IsRecurring, RecurringType, ImportanceLevel, Notes) OUTPUT inserted.* VALUES (@title, @date, @cat, @recur, @recurType, @importance, @notes)",
      );
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    next(error);
  }
});
app.delete("/api/events/:id", async (req, res, next) => {
  try {
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, req.params.id)
      .query("DELETE FROM memory.AnniversaryEvent WHERE EventId = @id");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const wishFromRow = (row) => ({
  id: String(row.WishId),
  text: row.WishText,
  completed: Boolean(row.IsCompleted),
  createdAt: row.CreatedAt,
});
app.get("/api/wishes", async (_, res, next) => {
  try {
    const result = await pool.request().query("SELECT WishId, WishText, IsCompleted, CreatedAt FROM memory.SharedWish ORDER BY IsCompleted ASC, CreatedAt DESC");
    res.json(result.recordset.map(wishFromRow));
  } catch (error) { next(error); }
});
app.post("/api/wishes", async (req, res, next) => {
  const text = String(req.body.text || "").trim();
  if (!text || text.length > 200) return res.status(400).json({ error: "Điều ước cần có từ 1 đến 200 ký tự." });
  try {
    const result = await pool.request().input("text", sql.NVarChar(200), text).query("INSERT INTO memory.SharedWish (WishText) OUTPUT inserted.WishId, inserted.WishText, inserted.IsCompleted, inserted.CreatedAt VALUES (@text)");
    res.status(201).json(wishFromRow(result.recordset[0]));
  } catch (error) { next(error); }
});
app.patch("/api/wishes/:id", async (req, res, next) => {
  try {
    const result = await pool.request().input("id", sql.UniqueIdentifier, req.params.id).input("completed", sql.Bit, req.body.completed ? 1 : 0).query("UPDATE memory.SharedWish SET IsCompleted = @completed OUTPUT inserted.WishId, inserted.WishText, inserted.IsCompleted, inserted.CreatedAt WHERE WishId = @id");
    if (!result.recordset.length) return res.status(404).json({ error: "Không tìm thấy điều ước." });
    res.json(wishFromRow(result.recordset[0]));
  } catch (error) { next(error); }
});
app.delete("/api/wishes/:id", async (req, res, next) => {
  try {
    await pool.request().input("id", sql.UniqueIdentifier, req.params.id).query("DELETE FROM memory.SharedWish WHERE WishId = @id");
    res.status(204).end();
  } catch (error) { next(error); }
});

const entryTypes = new Set(["journal", "gift", "challenge", "expense", "mood", "capsule", "place"]);
app.get("/api/settings", async (_, res, next) => {
  try {
    const result = await pool.request().query("SELECT SettingValue FROM memory.SharedSetting WHERE SettingKey = N'relationshipStart'");
    res.json({ relationshipStart: result.recordset[0]?.SettingValue || "2025-05-08" });
  } catch (error) { next(error); }
});
app.put("/api/settings", async (req, res, next) => {
  const value = String(req.body.relationshipStart || "");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return res.status(400).json({ error: "Ngày bắt đầu không hợp lệ." });
  try {
    await pool.request().input("value", sql.NVarChar(10), value).query("UPDATE memory.SharedSetting SET SettingValue = @value, UpdatedAt = SYSUTCDATETIME() WHERE SettingKey = N'relationshipStart'; IF @@ROWCOUNT = 0 INSERT INTO memory.SharedSetting (SettingKey, SettingValue) VALUES (N'relationshipStart', @value)");
    res.json({ relationshipStart: value });
  } catch (error) { next(error); }
});
function mapEntry(row) {
  const targetDate = row.TargetDate ? new Date(row.TargetDate).toISOString().slice(0, 10) : null;
  const locked = row.EntryType === "capsule" && targetDate > new Date().toISOString().slice(0, 10);
  return { id: String(row.EntryId), type: row.EntryType, title: row.Title, body: locked ? null : row.Body, mood: row.Mood, amount: row.Amount, targetDate, completed: Boolean(row.IsCompleted), locked, createdAt: row.CreatedAt };
}
app.get("/api/entries", async (req, res, next) => {
  const type = String(req.query.type || "");
  if (!entryTypes.has(type)) return res.status(400).json({ error: "Loại nội dung không hợp lệ." });
  try {
    const result = await pool.request().input("type", sql.VarChar(16), type).query("SELECT EntryId, EntryType, Title, Body, Mood, Amount, TargetDate, IsCompleted, CreatedAt FROM memory.SharedEntry WHERE EntryType = @type ORDER BY TargetDate DESC, CreatedAt DESC");
    res.json(result.recordset.map(mapEntry));
  } catch (error) { next(error); }
});
app.post("/api/entries", async (req, res, next) => {
  const type = String(req.body.type || ""), title = String(req.body.title || "").trim(), body = String(req.body.body || "").trim();
  const amount = req.body.amount === "" || req.body.amount == null ? null : Number(req.body.amount);
  const targetDate = String(req.body.targetDate || "").slice(0, 10) || null;
  if (!entryTypes.has(type) || !title || title.length > 150 || body.length > 3000 || (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1000000000))) return res.status(400).json({ error: "Kiểm tra lại nội dung, số tiền hoặc loại mục." });
  if (type === "capsule" && (!targetDate || targetDate <= new Date().toISOString().slice(0, 10))) return res.status(400).json({ error: "Thư tương lai cần có ngày mở sau hôm nay." });
  try {
    const result = await pool.request().input("type", sql.VarChar(16), type).input("title", sql.NVarChar(150), title).input("body", sql.NVarChar(3000), body || null).input("mood", sql.NVarChar(24), String(req.body.mood || "").slice(0, 24) || null).input("amount", sql.Decimal(12, 2), amount).input("date", sql.Date, targetDate).query("INSERT INTO memory.SharedEntry (EntryType, Title, Body, Mood, Amount, TargetDate) OUTPUT inserted.EntryId, inserted.EntryType, inserted.Title, inserted.Body, inserted.Mood, inserted.Amount, inserted.TargetDate, inserted.IsCompleted, inserted.CreatedAt VALUES (@type, @title, @body, @mood, @amount, @date)");
    res.status(201).json(mapEntry(result.recordset[0]));
  } catch (error) { next(error); }
});
app.patch("/api/entries/:id", async (req, res, next) => {
  try {
    const result = await pool.request().input("id", sql.UniqueIdentifier, req.params.id).input("completed", sql.Bit, req.body.completed ? 1 : 0).query("UPDATE memory.SharedEntry SET IsCompleted = @completed OUTPUT inserted.EntryId, inserted.EntryType, inserted.Title, inserted.Body, inserted.Mood, inserted.Amount, inserted.TargetDate, inserted.IsCompleted, inserted.CreatedAt WHERE EntryId = @id AND EntryType = 'challenge'");
    if (!result.recordset.length) return res.status(404).json({ error: "Không tìm thấy thử thách." });
    res.json(mapEntry(result.recordset[0]));
  } catch (error) { next(error); }
});
app.delete("/api/entries/:id", async (req, res, next) => {
  try { await pool.request().input("id", sql.UniqueIdentifier, req.params.id).query("DELETE FROM memory.SharedEntry WHERE EntryId = @id"); res.status(204).end(); }
  catch (error) { next(error); }
});

io.on("connection", (socket) => {
  socket.on("chat:message", async (data) => {
    try {
      io.emit("chat:message", await saveMessage(data));
    } catch {
      socket.emit("chat:error", "Tin nhắn không hợp lệ");
    }
  });
  socket.on("location:update", async (data) => {
    try {
      io.emit("location:update", await saveLocation(data));
    } catch {
      socket.emit("location:error", "Không thể cập nhật vị trí");
    }
  });
});
app.use((error, _, res, next) => {
  if (error instanceof multer.MulterError)
    return res.status(400).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: "Không thể xử lý yêu cầu database" });
});
sql
  .connect(config)
  .then((connection) => {
    pool = connection;
    server.listen(port, () => console.log(`http://localhost:${port}`));
  })
  .catch((error) => {
    console.error(
      "Không thể kết nối SQL Server:",
      util.inspect(error, { depth: 4 }),
    );
    process.exit(1);
  });
