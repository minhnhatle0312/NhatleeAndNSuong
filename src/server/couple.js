"use strict";
require("dotenv").config();
const express = require("express"), http = require("http"), path = require("path"), fs = require("fs"), crypto = require("crypto");
const { promisify } = require("util"), scrypt = promisify(crypto.scrypt), multer = require("multer"), { Server } = require("socket.io"), { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, "../.."), dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data")), uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(root, "uploads"));
fs.mkdirSync(dataDir, { recursive: true }); fs.mkdirSync(uploadDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "memories.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS love_spaces(id TEXT PRIMARY KEY, settings TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS love_users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, profile TEXT NOT NULL, space TEXT NOT NULL REFERENCES love_spaces(id), created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS love_sessions(hash TEXT PRIMARY KEY, user TEXT NOT NULL REFERENCES love_users(id), expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS love_invites(code TEXT PRIMARY KEY, user TEXT NOT NULL REFERENCES love_users(id), expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS love_records(id TEXT PRIMARY KEY, space TEXT NOT NULL REFERENCES love_spaces(id), owner TEXT NOT NULL REFERENCES love_users(id), kind TEXT NOT NULL, payload TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS love_records_space_kind ON love_records(space,kind,created);
CREATE TABLE IF NOT EXISTS love_uploads(id TEXT PRIMARY KEY, space TEXT NOT NULL, owner TEXT NOT NULL, url TEXT UNIQUE NOT NULL, mime TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS love_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
const app = express(), server = http.createServer(app), io = new Server(server, { maxHttpBufferSize: 128 * 1024 });
let experience = null;
app.disable("x-powered-by"); app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));
app.use(express.json({ limit: "160kb" }));
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY", "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self)" });
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if ((origin && new URL(origin).host !== req.get("host")) || req.get("sec-fetch-site") === "cross-site") return res.status(403).json({ error: "Yêu cầu phải đến từ ứng dụng này." });
  }
  next();
});
const uuid = () => crypto.randomUUID(), now = () => new Date().toISOString(), today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const get = (sql, ...args) => db.prepare(sql).get(...args), all = (sql, ...args) => db.prepare(sql).all(...args), run = (sql, ...args) => db.prepare(sql).run(...args);
const parse = (v) => JSON.parse(v), hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function text(v, max = 3000) { return String(v ?? "").trim().slice(0, max); }
function num(v, min, max, fallback = min) { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
function dateValid(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || "") && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v; }
function transaction(fn) { db.exec("BEGIN IMMEDIATE"); try { const r = fn(); db.exec("COMMIT"); return r; } catch(e) { db.exec("ROLLBACK"); throw e; } }
const route = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
function userForToken(token) {
  if (!token) return null;
  return get("SELECT u.* FROM love_users u JOIN love_sessions s ON s.user=u.id WHERE s.hash=? AND s.expires>?", hash(token), Date.now());
}
function cookieToken(cookie = "") { const value = cookie.split(";").map(x => x.trim()).find(x => x.startsWith("love_session=")); return value ? value.slice(13) : ""; }
app.use((req, res, next) => { req.user = userForToken(cookieToken(req.headers.cookie)); next(); });
function auth(req, res, next) { if (!req.user) return res.status(401).json({ error: "Hãy đăng nhập để mở không gian của bạn." }); next(); }
function members(space) { return all("SELECT * FROM love_users WHERE space=? ORDER BY created", space); }
function profile(user, self = false) {
  const p = parse(user.profile);
  delete p.location;
  if (!self && !p.shareHealth) delete p.healthStatus;
  return { id: user.id, ...p, ...(self ? { email: user.email } : {}) };
}
function settings(space) { return parse(get("SELECT settings FROM love_spaces WHERE id=?", space).settings); }
function putSettings(space, s) { run("UPDATE love_spaces SET settings=? WHERE id=?", JSON.stringify(s), space); }
function emit(space, kind) { io.to(space).emit("sync", { kind }); }
function record(row) { return { ...parse(row.payload), id: row.id, owner: row.owner, createdAt: row.created, updatedAt: row.updated }; }
function records(space, kind) { return all("SELECT * FROM love_records WHERE space=? AND kind=? ORDER BY created DESC,id DESC", space, kind).map(record); }
function insert(user, kind, payload) {
  const id = uuid(), timestamp = now();
  run("INSERT INTO love_records VALUES(?,?,?,?,?,?,?)", id, user.space, user.id, kind, JSON.stringify(payload), timestamp, timestamp);
  experience?.created(user,kind,payload,id);
  emit(user.space, kind); return record(get("SELECT * FROM love_records WHERE id=?", id));
}
function writeRecord(row, payload) { run("UPDATE love_records SET payload=?,updated=? WHERE id=?", JSON.stringify(payload), now(), row.id); experience?.updated(row,payload); emit(row.space, row.kind); return record(get("SELECT * FROM love_records WHERE id=?", row.id)); }
function owned(req, kind, shared = false) {
  const row = get("SELECT * FROM love_records WHERE id=? AND space=? AND kind=?", req.params.id, req.user.space, kind);
  if (!row) fail("Không tìm thấy nội dung.", 404);
  if (!shared && row.owner !== req.user.id) fail("Chỉ người tạo được sửa nội dung này.", 403);
  if (row.owner !== req.user.id && parse(row.payload).shared === false) fail("Đây là nội dung riêng tư.", 403);
  return row;
}
function canReadUpload(user, file) {
  if (file.owner === user.id) return true;
  if (members(user.space).some(u => parse(u.profile).avatar === file.url)) return true;
  return all("SELECT * FROM love_records WHERE space=? AND json_extract(payload,'$.attachment.url')=?",user.space,file.url).some(row=>{const p=record(row);return (row.owner===user.id||p.shared!==false)&&(row.kind!=="capsule"||!safeRecord(p,"capsule").locked);});
}
function attachment(user, url) { if (!url) return null; const file = get("SELECT * FROM love_uploads WHERE space=? AND url=?", user.space, String(url)); if (!file || !canReadUpload(user,file)) fail("Tệp đính kèm không hợp lệ."); return { url: file.url, mime: file.mime, name: file.name }; }
function safeRecord(item, kind) { if(experience)return experience.redact(item,kind);return kind === "capsule" && item.date > today() ? { ...item, body: "", attachment:null, locked: true } : item; }
function visible(items, user, kind) { return items.filter(x => x.owner === user.id || x.shared !== false).map(x => safeRecord(x, kind)); }
function state(user) {
  const group = members(user.space), s = settings(user.space), partner = group.find(x => x.id !== user.id);
  const kinds = ["memory", "mood", "health", "schedule", "event", "wheel", "spin", "pet", "petlog", "game", "wish", "journal", "gift", "challenge", "expense", "capsule", "place", "checkin", "goal", "contribution", "settlement", "challengeDay", "reel", "annotation", "confession", "badge", "watch", "petplay", "garden"];
  return { me: profile(user, true), partner: partner ? profile(partner) : null, settings: s, spaceId: user.space,
    data: Object.fromEntries(kinds.map(k => [k, visible(records(user.space, k), user, k).map(x=>k==='game'?publicGame(x):x)])),
    locations: locationState(user), experience:experience?.summary(user), legacyAvailable: Boolean(get("SELECT value FROM love_meta WHERE key='legacyOwner' AND value=?", user.id)) && !get("SELECT value FROM love_meta WHERE key='legacyImported'") };
}
async function makePassword(password) { const salt = crypto.randomBytes(16).toString("hex"); return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`; }
async function verifyPassword(password, encoded) { const [salt, hex] = encoded.split(":"); const value = await scrypt(password, salt, 64); return crypto.timingSafeEqual(value, Buffer.from(hex, "hex")); }
function session(res, user) {
  const token = crypto.randomBytes(32).toString("hex");
  run("DELETE FROM love_sessions WHERE expires<?", Date.now());
  run("INSERT INTO love_sessions VALUES(?,?,?)", hash(token), user.id, Date.now() + 30 * 86400000);
  res.cookie("love_session", token, { httpOnly: true, sameSite: "strict", secure: process.env.COOKIE_SECURE === "true", maxAge: 30 * 86400000, path: "/" });
}
const attempts = new Map();
function authLimit(req, res, next) { const key = req.ip, t = Date.now(); let v = attempts.get(key); if (!v || t > v.until) v = { n: 0, until: t + 600000 }; v.n++; attempts.set(key, v); if (v.n > 30) return res.status(429).json({ error: "Bạn đã thử quá nhiều lần. Hãy thử lại sau 10 phút." }); next(); }
setInterval(() => { for (const [k,v] of attempts) if (v.until < Date.now()) attempts.delete(k); }, 600000).unref();
app.get("/api/health", (req, res) => res.json({ connected: true, database: "sqlite", app: "love-space", version: "3.0.0" }));
app.post("/api/auth/register", authLimit, route(async (req, res) => {
  const email = text(req.body.email, 254).toLowerCase(), password = String(req.body.password || ""), name = text(req.body.name, 70);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128 || !name) fail("Nhập tên, email hợp lệ và mật khẩu từ 8 đến 128 ký tự.");
  if (get("SELECT id FROM love_users WHERE email=?", email)) fail("Email này đã được đăng ký.", 409);
  const encoded = await makePassword(password), id = uuid(), space = uuid();
  transaction(() => {
    run("INSERT INTO love_spaces VALUES(?,?,?)", space, JSON.stringify({ relationshipStart: today(), chatBackground: "#f8ede8", chatColor: "#3d3039", coupleName: "Chuyện hai mình" }), now());
    run("INSERT INTO love_users VALUES(?,?,?,?,?,?)", id, email, encoded, JSON.stringify({ name, gender: "other", interestedIn: "all", birthday: "", bio: "", avatar: "", status: "Đang ở đây", healthStatus: "", shareHealth: false, locationEnabled: false }), space, now());
    if (!get("SELECT value FROM love_meta WHERE key='legacyOwner'")) run("INSERT INTO love_meta VALUES('legacyOwner',?)", id);
  });
  const user = get("SELECT * FROM love_users WHERE id=?", id); session(res, user); res.status(201).json(state(user));
}));
app.post("/api/auth/login", authLimit, route(async (req, res) => {
  const user = get("SELECT * FROM love_users WHERE email=?", text(req.body.email, 254).toLowerCase());
  if (!user || String(req.body.password || "").length > 128 || !await verifyPassword(String(req.body.password || ""), user.password)) fail("Email hoặc mật khẩu chưa đúng.", 401);
  session(res, user); res.json(state(user));
}));
app.post("/api/auth/logout", auth, (req, res) => {
  const p=parse(req.user.profile);p.locationEnabled=false;delete p.location;run("UPDATE love_users SET profile=? WHERE id=?",JSON.stringify(p),req.user.id);emit(req.user.space,"location");
  run("DELETE FROM love_sessions WHERE hash=?", hash(cookieToken(req.headers.cookie)));
  for (const socket of io.sockets.sockets.values()) if (socket.data.sessionHash === hash(cookieToken(req.headers.cookie))) socket.disconnect(true);
  res.clearCookie("love_session", { path: "/" }); res.json({ ok: true });
});
app.get("/api/state", auth, (req, res) => res.json(state(req.user)));
app.put("/api/profile", auth, route((req, res) => {
  const old = parse(req.user.profile), b = req.body, p = { ...old, name: text(b.name,70), birthday: text(b.birthday,10), gender: ["male","female","other"].includes(b.gender) ? b.gender : "other", interestedIn: ["male","female","all","other"].includes(b.interestedIn) ? b.interestedIn : "all", bio: text(b.bio,500), healthStatus: text(b.healthStatus,500), shareHealth: b.shareHealth === true, status: text(b.status,70), avatar: b.avatar || "" };
  if (!p.name || (p.birthday && (!dateValid(p.birthday) || p.birthday > today()))) fail("Kiểm tra lại tên và ngày sinh.");
  if (p.avatar) { const file = attachment(req.user,p.avatar); if (!file.mime.startsWith("image/")) fail("Ảnh đại diện phải là hình ảnh."); }
  run("UPDATE love_users SET profile=? WHERE id=?", JSON.stringify(p), req.user.id); emit(req.user.space, "profile"); res.json(profile({ ...req.user, profile: JSON.stringify(p) }, true));
}));
app.post("/api/auth/password", auth, route(async (req, res) => {
  const password = String(req.body.password || "");
  if (password.length < 8 || password.length > 128 || !await verifyPassword(String(req.body.current || "").slice(0,128), req.user.password)) fail("Mật khẩu hiện tại chưa đúng hoặc mật khẩu mới cần ít nhất 8 ký tự.");
  run("UPDATE love_users SET password=? WHERE id=?", await makePassword(password), req.user.id);
  run("DELETE FROM love_sessions WHERE user=?", req.user.id);
  for(const socket of io.sockets.sockets.values())if(socket.data.userId===req.user.id)socket.disconnect(true);
  session(res, req.user); res.json({ ok:true });
}));
app.post("/api/pair/invite", auth, route((req, res) => {
  if (members(req.user.space).length > 1) fail("Bạn đã có người thương trong không gian này.");
  const code = crypto.randomBytes(5).toString("hex").toUpperCase();
  run("DELETE FROM love_invites WHERE user=? OR expires<?", req.user.id, Date.now());
  run("INSERT INTO love_invites VALUES(?,?,?)", code, req.user.id, Date.now() + 86400000); res.json({ code, expires: new Date(Date.now()+86400000).toISOString() });
}));
app.post("/api/pair/join", auth, route((req, res) => {
  const invite = get("SELECT i.*,u.space FROM love_invites i JOIN love_users u ON u.id=i.user WHERE i.code=? AND i.expires>?", text(req.body.code,20).toUpperCase(), Date.now());
  if (!invite || invite.user === req.user.id) fail("Mã mời không đúng, đã dùng hoặc hết hạn.");
  if (members(req.user.space).length > 1 || members(invite.space).length > 1) fail("Một trong hai bạn đã được ghép đôi.");
  const oldSpace = req.user.space;
  transaction(() => {
    // Preserve both histories when independently started journeys are paired.
    for(const row of all("SELECT * FROM love_records WHERE space=? AND kind IN ('reward','badge','challengeDay')",oldSpace)){
      const p=parse(row.payload),key=row.kind==='reward'?'claimKey':row.kind==='badge'?'key':'day';
      if(get("SELECT id FROM love_records WHERE space=? AND kind=? AND json_extract(payload,?)=?",invite.space,row.kind,'$.'+key,p[key])){
        if(row.kind==='reward'){p.claimKey='merged:'+oldSpace+':'+p.claimKey;run("UPDATE love_records SET payload=? WHERE id=?",JSON.stringify(p),row.id);}
        else run("UPDATE love_records SET kind=? WHERE id=?",row.kind+'Archive',row.id);
      }
    }
    run("UPDATE love_records SET space=? WHERE space=?", invite.space, oldSpace); run("UPDATE love_uploads SET space=? WHERE space=?", invite.space, oldSpace);
    run("UPDATE love_users SET space=? WHERE id=?", invite.space, req.user.id); run("DELETE FROM love_invites WHERE user IN (?,?)", req.user.id, invite.user);
    run("DELETE FROM love_spaces WHERE id=?", oldSpace);
  });
  io.to(oldSpace).emit("pair:changed"); io.to(invite.space).emit("pair:changed");
  res.json({ ok:true });
}));
app.post("/api/pair/unlink", auth, route((req, res) => {
  if (members(req.user.space).length < 2) fail("Bạn chưa ghép đôi.");
  if (req.body.confirm !== "TÁCH ĐÔI") fail("Nhập TÁCH ĐÔI để xác nhận.");
  const old = req.user.space, space = uuid(), s = settings(old);
  transaction(() => {
    run("INSERT INTO love_spaces VALUES(?,?,?)", space, JSON.stringify(s), now());
    run("UPDATE love_users SET space=? WHERE id=?", space, req.user.id);
    run("UPDATE love_records SET space=? WHERE space=? AND owner=?", space, old, req.user.id);
    run("UPDATE love_uploads SET space=? WHERE space=? AND owner=?", space, old, req.user.id);
    // A detached space must not keep the other person's attachment references.
    for (const target of [old,space]) {
      const valid = new Set(all("SELECT url FROM love_uploads WHERE space=?",target).map(x=>x.url));
      for (const row of all("SELECT * FROM love_records WHERE space=?",target)) {
        const p = parse(row.payload); if(p.attachment && !valid.has(p.attachment.url)) { p.attachment=null; run("UPDATE love_records SET payload=? WHERE id=?",JSON.stringify(p),row.id); }
      }
      for(const member of members(target)) { const p=parse(member.profile); p.locationEnabled=false; delete p.location; if(p.avatar && !valid.has(p.avatar)) p.avatar=""; run("UPDATE love_users SET profile=? WHERE id=?",JSON.stringify(p),member.id); }
    }
  });
  io.to(old).emit("pair:changed"); res.json({ok:true});
}));
app.put("/api/settings", auth, route((req,res) => {
  const s = settings(req.user.space), b = req.body;
  if (b.relationshipStart !== undefined) { if(!dateValid(b.relationshipStart) || b.relationshipStart > today()) fail("Ngày bắt đầu cần là hôm nay hoặc trước đó."); s.relationshipStart = b.relationshipStart; }
  if (b.coupleName !== undefined) s.coupleName = text(b.coupleName,70) || "Chuyện hai mình";
  for (const k of ["chatBackground","chatColor"]) if (b[k] !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(b[k])) fail("Màu sắc không hợp lệ."); s[k]=b[k]; }
  putSettings(req.user.space,s); emit(req.user.space,"settings"); res.json(s);
}));
const upload = multer({ storage: multer.diskStorage({ destination: uploadDir, filename: (req, file, cb) => cb(null, `${uuid()}${({"image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/gif":".gif","image/avif":".avif","image/heic":".heic","video/mp4":".mp4","video/webm":".webm","video/quicktime":".mov","audio/webm":".webm","audio/ogg":".ogg","audio/mpeg":".mp3","audio/mp4":".m4a"})[file.mimetype] || ".bin"}`) }), limits: { fileSize: 50*1024*1024, files:1 }, fileFilter: (req,file,cb) => cb(null, /^(image\/(jpeg|png|webp|gif|avif|heic)|video\/(mp4|webm|quicktime)|audio\/(webm|ogg|mpeg|mp4))$/.test(file.mimetype)) });
app.post("/api/upload", auth, upload.single("file"), route((req,res) => {
  if (!req.file) fail("Chọn ảnh, video hoặc âm thanh hợp lệ (tối đa 50 MB).");
  const f = req.file, url = `/uploads/${f.filename}`;
  run("INSERT INTO love_uploads VALUES(?,?,?,?,?,?,?)",uuid(),req.user.space,req.user.id,url,f.mimetype,text(f.originalname,180),f.size);
  res.status(201).json({ url, mime:f.mimetype, name:text(f.originalname,180), size:f.size });
}));
app.get("/uploads/:file", auth, route((req,res) => {
  const file = get("SELECT * FROM love_uploads WHERE space=? AND url=?",req.user.space,`/uploads/${req.params.file}`);
  if(!file || !canReadUpload(req.user,file)) fail("Không tìm thấy tệp trong không gian của bạn.",404);
  if(path.basename(req.params.file)!==req.params.file) fail("Tệp không hợp lệ.");
  res.sendFile(path.join(uploadDir,req.params.file));
}));
const editableKinds = new Set(["memory","mood","health","schedule","event","wheel","wish","journal","gift","challenge","expense","capsule","place"]);
function clean(kind,b,user) {
  const p = { title:text(b.title,150), body:text(b.body,3000), date:text(b.date,10), shared:b.shared !== false, completed:b.completed === true };
  if(p.date && !dateValid(p.date)) fail("Ngày không hợp lệ.");
  if(kind === "health") { p.shared = b.shared === true; p.symptoms=text(b.symptoms,500); p.cycleStart=text(b.cycleStart,10); p.cycleLength=Math.round(num(b.cycleLength,21,45,28)); p.periodLength=Math.round(num(b.periodLength,2,10,5)); if(p.cycleStart && (!dateValid(p.cycleStart) || p.cycleStart>today())) fail("Ngày bắt đầu chu kỳ không hợp lệ."); if(parse(user.profile).gender !== "female") p.cycleStart=""; p.title=p.title || "Sức khỏe hôm nay"; }
  if(kind === "mood") { p.mood=text(b.mood,24); p.title=p.title || "Tâm trạng hôm nay"; if(!["🥰","😊","😌","🤗","😔","😤","😴","🥺"].includes(p.mood)) fail("Chọn một cảm xúc cho hôm nay."); p.date=p.date||today(); }
  if(kind === "schedule") {
    p.start=text(b.start,5); p.end=text(b.end,5); p.recurrence=["none","daily","weekly"].includes(b.recurrence)?b.recurrence:"none"; p.activity=text(b.activity,70); p.location=text(b.location,200);
    if(!p.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.end) || p.end<=p.start) fail("Lịch cần ngày và giờ kết thúc sau giờ bắt đầu.");
  }
  if(kind === "event") { if(!p.date) fail("Chọn ngày sự kiện."); p.recurring=b.recurring===true; p.category=text(b.category,30); p.location=text(b.location,200); p.budget=num(b.budget,0,1e12); }
  if(kind === "wheel") { p.options = Array.isArray(b.options) ? b.options.map(x=>text(x,70)).filter(Boolean).slice(0,30) : []; if(p.options.length<2) fail("Vòng quay cần từ 2 đến 30 lựa chọn."); }
  if(kind === "expense") { p.amount=num(b.amount,0,1e12); p.category=text(b.category,50); p.paidBy=members(user.space).some(u=>u.id===b.paidBy)?b.paidBy:user.id;p.splitFor=members(user.space).some(u=>u.id===b.splitFor)?b.splitFor:user.id;p.splitPercent=num(b.splitPercent,0,100,50);p.title=p.title||"Chi phí hẹn hò"; }
  if(kind === "capsule" && (!p.date || p.date<=today())) fail("Thư tương lai cần ngày mở sau hôm nay.");
  if(kind === "memory" || kind === "mood" || kind === "journal") p.attachment=attachment(user,b.attachment?.url);
  if(kind === "memory" && !p.attachment) fail("Hãy chọn ảnh hoặc video cho kỷ niệm.");
  if(kind === "memory" && !/^(image|video)\//.test(p.attachment.mime)) fail("Kỷ niệm cần ảnh hoặc video.");
  if(!p.title) fail("Nhập tiêu đề cho nội dung này.");
  return p;
}
app.post("/api/items/:kind", auth, route((req,res) => { const k=req.params.kind; if(!editableKinds.has(k)) fail("Loại nội dung không hợp lệ."); res.status(201).json(insert(req.user,k,clean(k,req.body,req.user))); }));
app.put("/api/items/:kind/:id", auth, route((req,res) => {
  const k=req.params.kind; if(!editableKinds.has(k)) fail("Loại nội dung không hợp lệ."); const row=owned(req,k);
  res.json(writeRecord(row,clean(k,req.body,req.user)));
}));
app.delete("/api/items/:kind/:id", auth, route((req,res) => {
  const k=req.params.kind; if(!editableKinds.has(k) && k!=="pet") fail("Không thể xóa nội dung này.");
  const row=owned(req,k); if(k==='health')run("DELETE FROM love_records WHERE space=? AND kind='schedule' AND json_extract(payload,'$.healthEntryId')=?",req.user.space,row.id);run("DELETE FROM love_records WHERE id=?",row.id); emit(req.user.space,k); res.json({ok:true});
}));
app.patch("/api/items/:kind/:id/complete", auth, route((req,res) => {
  if(!["wish","challenge","schedule"].includes(req.params.kind)) fail("Nội dung không hỗ trợ đánh dấu.");
  const row=owned(req,req.params.kind,true); res.json(writeRecord(row,{...parse(row.payload),completed:req.body.completed===true}));
}));
app.post("/api/wheels/:id/spin", auth, route((req,res) => {
  const row=owned(req,"wheel",true), wheel=parse(row.payload), index=crypto.randomInt(wheel.options.length);
  res.status(201).json(insert(req.user,"spin",{wheelId:row.id,title:wheel.title,result:wheel.options[index],index,count:wheel.options.length}));
}));
function locationState(user) {
  const group=members(user.space), me=parse(user.profile), other=group.find(x=>x.id!==user.id), p=other?parse(other.profile):null;
  const both=Boolean(other && me.locationEnabled && p.locationEnabled);
  const fresh=(x)=>x?.location && Date.now()-Date.parse(x.location.updatedAt)<15*60000 ? x.location : null;
  return { enabled:me.locationEnabled===true, partnerEnabled:p?.locationEnabled===true, both, me:fresh(me), partner:both?fresh(p):null };
}
app.put("/api/location", auth, route((req,res) => {
  const p=parse(req.user.profile), b=req.body;
  p.locationEnabled=b.enabled===true;
  if(!p.locationEnabled) delete p.location;
  else if(b.latitude!==undefined) {
    const lat=Number(b.latitude),lng=Number(b.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180) fail("Tọa độ không hợp lệ.");
    p.location={latitude:lat,longitude:lng,accuracy:num(b.accuracy,0,1e6),speed:b.speed==null?null:num(b.speed,0,400)*3.6,heading:b.heading==null?null:num(b.heading,0,360),updatedAt:now()};
  }
  run("UPDATE love_users SET profile=? WHERE id=?",JSON.stringify(p),req.user.id); emit(req.user.space,"location"); res.json(locationState({...req.user,profile:JSON.stringify(p)}));
}));
app.get("/api/messages", auth, (req,res) => res.json(records(req.user.space,"message").slice(0,300).reverse()));
app.post("/api/messages", auth, route((req,res) => {
  const body=text(req.body.body,4000), file=attachment(req.user,req.body.attachment?.url);
  if(!body&&!file) fail("Nhập tin nhắn hoặc chọn tệp.");
  res.status(201).json(insert(req.user,"message",{body,attachment:file,sender:parse(req.user.profile).name}));
}));
app.post("/api/pets", auth, route((req,res) => {
  const species=text(req.body.species,20), name=text(req.body.name,50);
  if(!["cat","dog","bunny","fox","panda","dragon","penguin","bear","hamster","otter","unicorn","deer"].includes(species)||!name) fail("Chọn loài và đặt tên cho bé.");
  if(records(req.user.space,"pet").length>=12) fail("Ngôi nhà đã có đủ 12 bé. Hãy chăm sóc các bé hiện tại nhé.");
  res.status(201).json(insert(req.user,"pet",{name,species,xp:0,coins:0,hunger:85,energy:90,happiness:90,cleanliness:90,activity:"idle",lastAction:0,lastDecay:Date.now(),accessory:"none"}));
}));
app.post("/api/pets/:id/action", auth, route((req,res) => {
  const row=owned(req,"pet",true), p=parse(row.payload), action=req.body.action;
  const actions={feed:[25,0,5,0,8],play:[-12,-15,25,-5,15],walk:[-10,-12,18,-10,12],sleep:[-3,35,5,0,8],bath:[0,-5,10,40,10],cuddle:[0,0,12,0,5]};
  if(action==="accessory") {
    if(!["none","bow","crown","flower"].includes(req.body.accessory)) fail("Phụ kiện không hợp lệ.");
    if(req.body.accessory!=="none"&&p.coins<20) fail("Cần 20 xu để mua phụ kiện.");
    if(req.body.accessory!=="none") p.coins-=20; p.accessory=req.body.accessory;
  } else {
    if(!actions[action]) fail("Hoạt động không hợp lệ.");
    if(Date.now()-p.lastAction<1800) fail("Đợi bé một chút rồi chăm tiếp nhé.");
    const hours=Math.min(72,(Date.now()-(p.lastDecay||Date.now()))/36e5);
    ["hunger","energy","happiness","cleanliness"].forEach((k,i)=>p[k]=Math.max(0,Math.min(100,p[k]-hours*(i===0?3:2)+actions[action][i])));
    p.xp+=actions[action][4]; p.coins+=3; p.activity=action; p.lastAction=Date.now(); p.lastDecay=Date.now();
    insert(req.user,"petlog",{petId:row.id,title:p.name,action});
  }
  res.json(writeRecord(row,p));
}));
app.post("/api/games", auth, route((req,res) => {
  const kind=req.body.kind;
  if(!["caro","tic","memory","rps"].includes(kind)) fail("Trò chơi không hợp lệ.");
  const size=kind==="caro"?15:3;
  const p={kind,title:({caro:"Cờ caro",tic:"Tic Tac Toe",memory:"Lật thẻ ký ức",rps:"Oẳn tù tì"})[kind],players:[req.user.id],turn:req.user.id,status:"waiting",board:Array(size*size).fill(null),winner:null,moves:0};
  if(kind==="memory") { p.board=Array(16).fill(null); p.deck=[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7]; for(let i=15;i>0;i--){const j=crypto.randomInt(i+1); [p.deck[i],p.deck[j]]=[p.deck[j],p.deck[i]];} p.flipped=[];p.matched=[];p.scores={}; }
  if(kind==="rps") p.choices={};
  const game=insert(req.user,"game",p); res.status(201).json(publicGame(game));
}));
function publicGame(game) {
  const p={...game};
  if(p.kind==="memory") { p.cards=p.deck.map((x,i)=>p.matched.includes(i)||p.flipped.includes(i)?x:null); delete p.deck; }
  if(p.kind==="rps"&&p.status!=="finished") p.choices=Object.fromEntries(Object.keys(p.choices).map(k=>[k,"ready"]));
  return p;
}
// publicGame also redacts hidden cards and choices in /api/state and exports.
app.post("/api/games/:id/join", auth, route((req,res) => {
  const row=owned(req,"game",true), p=parse(row.payload);
  if(!p.players.includes(req.user.id)) { if(p.players.length>=2||p.status!=="waiting") fail("Phòng chơi đã đủ người."); p.players.push(req.user.id); p.status="playing"; }
  res.json(publicGame(writeRecord(row,p)));
}));
app.post("/api/games/:id/move", auth, route((req,res) => {
  const row=owned(req,"game",true), p=parse(row.payload), user=req.user.id;
  if(p.status!=="playing"||!p.players.includes(user)) fail("Cần hai người vào phòng và trận đấu đang diễn ra.");
  if(p.kind==="rps") {
    if(!["rock","paper","scissors"].includes(req.body.choice)||p.choices[user]) fail("Lựa chọn không hợp lệ hoặc đã được gửi.");
    p.choices[user]=req.body.choice;
    if(Object.keys(p.choices).length===2) {const [a,b]=p.players, ca=p.choices[a],cb=p.choices[b];p.winner=ca===cb?"draw":({rock:"scissors",paper:"rock",scissors:"paper"}[ca]===cb?a:b);p.status="finished";}
  } else {
    if(p.turn!==user) fail("Đang đến lượt người thương.");
    const index=Number(req.body.index);
    if(!Number.isInteger(index)||index<0||index>=p.board.length) fail("Ô chơi không hợp lệ.");
    const other=p.players.find(x=>x!==user);
    if(p.kind==="memory") {
      if(p.resolveAt&&Date.now()>=p.resolveAt){p.flipped=[];p.resolveAt=null;}
      if(p.resolveAt||p.matched.includes(index)||p.flipped.includes(index)) fail("Chờ lật thẻ hoặc chọn một ô khác.");
      p.flipped.push(index);
      if(p.flipped.length===2) { const [a,b]=p.flipped; if(p.deck[a]===p.deck[b]){p.matched.push(a,b);p.scores[user]=(p.scores[user]||0)+1;p.flipped=[];}else{p.resolveAt=Date.now()+1500;p.turn=other;} }
      if(p.matched.length===16){p.status="finished";const[a,b]=p.players;p.winner=(p.scores[a]||0)===(p.scores[b]||0)?"draw":((p.scores[a]||0)>(p.scores[b]||0)?a:b);}
    } else {
      if(p.board[index]) fail("Ô này đã có người chọn."); p.board[index]=user;p.moves++;
      const size=p.kind==="caro"?15:3, need=p.kind==="caro"?5:3, x=index%size,y=Math.floor(index/size);
      const won=[[1,0],[0,1],[1,1],[1,-1]].some(([dx,dy])=>{let count=1;for(const sign of [-1,1])for(let n=1;n<need;n++){const xx=x+dx*n*sign,yy=y+dy*n*sign;if(xx<0||xx>=size||yy<0||yy>=size||p.board[yy*size+xx]!==user)break;count++;}return count>=need;});
      if(won){p.status="finished";p.winner=user;}else if(p.moves===size*size){p.status="finished";p.winner="draw";}else p.turn=other;
    }
  }
  res.json(publicGame(writeRecord(row,p)));
}));
app.get("/api/export",auth, (req,res)=>{res.set("Content-Disposition",'attachment; filename="chuyen-hai-minh.json"');res.json({...state(req.user),messages:records(req.user.space,"message").reverse(),exportedAt:now()});});
app.post("/api/legacy/import",auth,route((req,res)=>{
  if(!get("SELECT value FROM love_meta WHERE key='legacyOwner' AND value=?",req.user.id)||get("SELECT value FROM love_meta WHERE key='legacyImported'")) fail("Dữ liệu cũ không khả dụng.");
  let count=0;
  transaction(()=>{
    const exists=(table)=>get("SELECT name FROM sqlite_master WHERE type='table' AND name=?",table);
    if(exists("media"))for(const m of all("SELECT * FROM media")){
      if(!m.relative_path?.startsWith("/uploads/")||!fs.existsSync(path.join(uploadDir,path.basename(m.relative_path))))continue;
      const mime=m.media_type==="video"?"video/mp4":"image/jpeg";
      run("INSERT OR IGNORE INTO love_uploads VALUES(?,?,?,?,?,?,?)",uuid(),req.user.space,req.user.id,m.relative_path,mime,m.original_file_name||"Kỷ niệm cũ",m.file_size_bytes||0);
      insert(req.user,"memory",{title:m.title||"Kỷ niệm cũ",body:m.caption||"",date:(m.memory_date||"").slice(0,10),attachment:{url:m.relative_path,mime,name:m.original_file_name||"Kỷ niệm"},shared:true});count++;
    }
    if(exists("anniversary_event"))for(const e of all("SELECT * FROM anniversary_event")){insert(req.user,"event",{title:e.title,body:e.notes||"",date:e.event_date.slice(0,10),recurring:Boolean(e.is_recurring),shared:true});count++;}
    if(exists("shared_wish"))for(const w of all("SELECT * FROM shared_wish")){insert(req.user,"wish",{title:w.wish_text,completed:Boolean(w.is_completed),shared:true});count++;}
    if(exists("shared_entry"))for(const e of all("SELECT * FROM shared_entry")){insert(req.user,e.entry_type,{title:e.title,body:e.body||"",date:e.target_date||"",mood:e.mood||"",amount:e.amount||0,completed:Boolean(e.is_completed),shared:true});count++;}
    if(exists("chat_message"))for(const m of all("SELECT * FROM chat_message ORDER BY created_at")){const item=insert(req.user,"message",{body:m.message,sender:m.sender,legacy:true});run("UPDATE love_records SET created=? WHERE id=?",m.created_at,item.id);count++;}
    if(exists("shared_setting")){const old=get("SELECT setting_value FROM shared_setting WHERE setting_key='relationshipStart'");if(old){const s=settings(req.user.space);s.relationshipStart=old.setting_value;putSettings(req.user.space,s);}}
    run("INSERT INTO love_meta VALUES('legacyImported',?)",now());
  });res.json({count});
}));
io.use((socket,next)=>{
  try { const origin=socket.handshake.headers.origin; if(origin&&new URL(origin).host!==socket.handshake.headers.host)return next(new Error("Origin không hợp lệ"));
    const token=cookieToken(socket.handshake.headers.cookie), user=userForToken(token);if(!user)return next(new Error("Hãy đăng nhập"));socket.data.userId=user.id;socket.data.sessionHash=hash(token);next();
  }catch(e){next(e);}
});
const calls=new Map();
io.on("connection",socket=>{
  const current=()=>{const session=get("SELECT user FROM love_sessions WHERE hash=? AND expires>?",socket.data.sessionHash,Date.now());return session?get("SELECT * FROM love_users WHERE id=?",session.user):null;};
  const user=current();if(!user)return socket.disconnect(true);socket.join(user.space);socket.data.space=user.space;
  socket.use((packet,next)=>{const u=current();if(!u||u.space!==socket.data.space){socket.disconnect(true);return;}next();});
  socket.to(user.space).emit("presence",{id:user.id,online:true});
  socket.on("typing",()=>socket.to(user.space).emit("typing",{id:user.id}));
  socket.on("call:invite",({video=true}={})=>{
    if(members(user.space).length<2)return socket.emit("call:unavailable","Ghép đôi để gọi người thương.");
    if(calls.has(user.space))return socket.emit("call:unavailable","Một cuộc gọi khác đang diễn ra.");
    const peers=[...io.sockets.sockets.values()].filter(s=>s.data.space===user.space&&s.data.userId!==user.id);
    if(!peers.length)return socket.emit("call:unavailable","Người thương chưa trực tuyến.");
    calls.set(user.space,{caller:socket.id,callee:null,created:Date.now()});
    for(const remote of peers)remote.emit("call:incoming",{from:socket.id,name:parse(user.profile).name,video:video===true});
  });
  socket.on("call:accept",()=>{const c=calls.get(user.space);if(!c||c.callee||io.sockets.sockets.get(c.caller)?.data.userId===socket.data.userId)return;c.callee=socket.id;io.to(c.caller).emit("call:accepted");socket.to(user.space).except(c.caller).emit("call:dismiss");});
  socket.on("call:signal",payload=>{const c=calls.get(user.space);if(!c||!c.callee)return;const to=socket.id===c.caller?c.callee:socket.id===c.callee?c.caller:null;if(to&&payload&&JSON.stringify(payload).length<100000)io.to(to).emit("call:signal",payload);});
  const hangup=()=>{const c=calls.get(user.space);if(c&&(socket.id===c.caller||socket.id===c.callee||(!c.callee&&socket.data.userId!==io.sockets.sockets.get(c.caller)?.data.userId))){calls.delete(user.space);io.to(user.space).emit("call:ended");}};
  socket.on("call:end",hangup);socket.on("disconnect",()=>{hangup();socket.to(user.space).emit("presence",{id:user.id,online:false});});
});
setInterval(()=>{for(const[space,c]of calls)if(!c.callee&&Date.now()-c.created>45000){calls.delete(space);io.to(space).emit("call:ended");}},5000).unref();
app.get("/api/rtc-config",auth,(req,res)=>{
  let iceServers=[];
  if(process.env.STUN_URL)iceServers.push({urls:process.env.STUN_URL});
  if(process.env.TURN_URL)iceServers.push({urls:process.env.TURN_URL,username:process.env.TURN_USERNAME||"",credential:process.env.TURN_PASSWORD||""});
  res.json({iceServers});
});
experience = require("./experience.js")({app,io,db,get,all,run,parse,record,records,insert,writeRecord,owned,attachment,members,profile,settings,putSettings,emit,auth,route,fail,text,num,dateValid,today,now,uuid,transaction,makePassword,verifyPassword});
app.use("/api",(req,res)=>res.status(404).json({error:"Đường dẫn không tồn tại."}));
app.use(express.static(path.join(root,"public"),{index:"index.html",maxAge:0}));
app.use((error,req,res,next)=>{if(req.file&&error.status)fs.unlink(req.file.path,()=>{});const status=error instanceof multer.MulterError?400:error.status||500;if(status>=500)console.error(error);res.status(status).json({error:status>=500?"Chưa xử lý được yêu cầu. Hãy thử lại.":error.message});});
const port=Number(process.env.PORT||3000),host=process.env.HOST||"127.0.0.1";
server.listen(port,host,()=>console.log(`Chuyện hai mình đang chạy tại http://localhost:${port} (${host})`));
function shutdown(){io.close();server.close(()=>{db.close();process.exit(0);});setTimeout(()=>process.exit(0),5000).unref();}
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
