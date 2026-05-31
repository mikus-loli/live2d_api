var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var BASE = path.join(__dirname, '..');
var MODEL_DIR = path.join(BASE, 'model');
var MODEL_LIST_FILE = path.join(BASE, 'model_list.json');
var USERS_FILE = path.join(__dirname, 'api', 'users.json');

var MAX_LOGIN_ATTEMPTS = 5;
var LOCKOUT_DURATION = 900;
var SESSION_LIFETIME = 86400;
var TOKEN_BYTES = 32;

var sessions = {};
var rateLimitStore = {};
var usersCache = null;
var usersCacheTime = 0;
var sseClients = [];

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function jsonRes(res, data, statusCode) {
  var sc = statusCode || 200;
  res.writeHead(sc, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end(JSON.stringify(data));
}

function scanDir(dir, base) {
  var result = [];
  if (!fs.existsSync(dir)) return result;
  var items = fs.readdirSync(dir);
  items.forEach(function (item) {
    if (item === '.' || item === '..') return;
    var full = path.join(dir, item);
    var rel = base ? base + '/' + item : item;
    if (fs.statSync(full).isDirectory()) {
      result = result.concat(scanDir(full, rel));
    } else {
      result.push({ name: rel, size: fs.statSync(full).size });
    }
  });
  return result;
}

function findModel3Json(dir) {
  if (!fs.existsSync(dir)) return null;
  var items = fs.readdirSync(dir);
  for (var i = 0; i < items.length; i++) {
    if (/\.model3\.json$/i.test(items[i])) {
      return items[i];
    }
  }
  return null;
}

function extractTexturesFromConfig(config) {
  if (config.FileReferences && Array.isArray(config.FileReferences.Textures)) {
    return config.FileReferences.Textures;
  }
  if (config.textures && Array.isArray(config.textures)) {
    return config.textures;
  }
  return [];
}

function getModelInfo(modelName) {
  var dir = path.join(MODEL_DIR, modelName);
  var info = { textures_count: 0, has_moc: false, has_physics: false, has_pose: false, file_count: 0 };
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return info;
  var files = scanDir(dir);
  info.file_count = files.length;
  files.forEach(function (f) {
    var ext = path.extname(f.name).toLowerCase();
    var base = path.basename(f.name);
    if (ext === '.moc' || ext === '.moc3') info.has_moc = true;
    if (/\.physics(3)?\.json$/i.test(base)) info.has_physics = true;
    if (base === 'pose.json') info.has_pose = true;
    if (/\.(png|jpg|avif)$/i.test(base)) info.textures_count++;
  });
  var indexPath = path.join(dir, 'index.json');
  var model3Name = findModel3Json(dir);
  var model3Path = model3Name ? path.join(dir, model3Name) : null;
  var configPath = fs.existsSync(indexPath) ? indexPath : model3Path;
  if (configPath) {
    try {
      var config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      var textures = extractTexturesFromConfig(config);
      if (textures.length > 0) info.textures_count = textures.length;
    } catch (e) {}
  }
  var cachePath = path.join(dir, 'textures.cache');
  if (fs.existsSync(cachePath)) {
    try {
      var cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (Array.isArray(cache) && cache.length > 0) {
        if (typeof cache[0] === 'string') info.textures_count = cache.length;
        else if (Array.isArray(cache[0])) info.textures_count = cache[0].length;
      }
    } catch (e) {}
  }
  return info;
}

function hasModelFiles(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  if (fs.existsSync(path.join(dir, 'index.json'))) return true;
  if (fs.existsSync(path.join(dir, 'model.moc'))) return true;
  var items = fs.readdirSync(dir);
  for (var i = 0; i < items.length; i++) {
    if (items[i] === '.' || items[i] === '..') continue;
    var ext = path.extname(items[i]).toLowerCase();
    if (ext === '.moc3' || ext === '.moc') return true;
    if (/\.model3\.json$/i.test(items[i])) return true;
  }
  return false;
}

function extractMotionsFromConfig(config) {
  var motions = {};
  if (config.FileReferences && config.FileReferences.Motions) {
    var refs = config.FileReferences.Motions;
    Object.keys(refs).forEach(function (group) {
      motions[group] = refs[group].map(function (m) {
        return { file: m.File, sound: m.Sound || null, fade_in: m.FadeInTime, fade_out: m.FadeOutTime };
      });
    });
  }
  if (config.motions) {
    Object.keys(config.motions).forEach(function (group) {
      if (!motions[group]) motions[group] = [];
      config.motions[group].forEach(function (m) {
        motions[group].push({ file: m.file || m.File, sound: m.sound || m.Sound || null });
      });
    });
  }
  return motions;
}

function convertModel3ToLegacy(config, modelName) {
  var json = {};
  var ref = config.FileReferences;
  if (ref) {
    json.model = ref.Moc;
    json.textures = ref.Textures || [];
    json.physics = ref.Physics || null;
    json.pose = ref.Pose || null;
    json.display = ref.DisplayInfo || null;
  }
  if (config.Groups) {
    json.motions = {};
    config.Groups.forEach(function (g) {
      json.motions[g.Name] = [];
    });
  }
  if (config.HitAreas) {
    json.hit_areas = config.HitAreas;
  }
  return json;
}

function loadUsers() {
  var now = Date.now();
  if (usersCache && (now - usersCacheTime) < 5000) return usersCache;
  try {
    usersCache = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    usersCacheTime = now;
  } catch (e) {
    usersCache = { users: {}, reset_tokens: {} };
  }
  if (!usersCache.users) usersCache.users = {};
  if (!usersCache.reset_tokens) usersCache.reset_tokens = {};
  return usersCache;
}

function saveUsers(data) {
  usersCache = data;
  usersCacheTime = Date.now();
  var dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function checkRateLimit(ip, action) {
  var now = Date.now();
  if (!rateLimitStore[action]) rateLimitStore[action] = {};
  if (!rateLimitStore[action][ip]) {
    rateLimitStore[action][ip] = { attempts: 0, firstAttempt: 0 };
  }
  var entry = rateLimitStore[action][ip];
  if (now - entry.firstAttempt > 60000) {
    entry.attempts = 1;
    entry.firstAttempt = now;
  } else {
    entry.attempts++;
  }
  return entry.attempts <= MAX_LOGIN_ATTEMPTS;
}

function clearRateLimit(ip, action) {
  if (rateLimitStore[action] && rateLimitStore[action][ip]) {
    delete rateLimitStore[action][ip];
  }
}

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

function getClientIP(req) {
  var forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

function parseCookies(req) {
  var cookies = {};
  var h = req.headers.cookie || '';
  h.split(';').forEach(function (pair) {
    var parts = pair.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return cookies;
}

function getSession(req) {
  var cookies = parseCookies(req);
  var token = cookies['admin_token'];
  if (!token || !sessions[token]) return null;
  var session = sessions[token];
  if (Date.now() - session.created > SESSION_LIFETIME * 1000) {
    delete sessions[token];
    return null;
  }
  session.created = Date.now();
  return session.user;
}

function createSession(res, user) {
  var token = generateToken();
  sessions[token] = {
    user: { username: user.username, role: user.role, email: user.email },
    created: Date.now(),
  };
  res.setHeader('Set-Cookie',
    'admin_token=' + token + '; Path=/admin/; HttpOnly; SameSite=Lax; Max-Age=' + SESSION_LIFETIME);
  return token;
}

function destroySession(req, res) {
  var cookies = parseCookies(req);
  var token = cookies['admin_token'];
  if (token && sessions[token]) delete sessions[token];
  res.setHeader('Set-Cookie', 'admin_token=; Path=/admin/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function requireAuth(req, res) {
  var user = getSession(req);
  if (!user) {
    jsonRes(res, { success: false, data: null, message: '未登录或会话已过期' }, 401);
    return null;
  }
  return user;
}

function readBody(req, cb) {
  var body = '';
  req.on('data', function (c) { body += c; });
  req.on('end', function () { cb(body); });
}

function handleLogin(req, res) {
  if (req.method !== 'POST') return jsonRes(res, { success: false, data: null, message: 'Method not allowed' }, 405);

  readBody(req, function (body) {
    var input;
    try { input = JSON.parse(body); } catch (e) { return jsonRes(res, { success: false, data: null, message: 'Invalid JSON' }); }

    var username = (input.username || '').trim();
    var password = input.password || '';
    var ip = getClientIP(req);

    if (!username || !password) return jsonRes(res, { success: false, data: null, message: '请输入用户名和密码' });
    if (!checkRateLimit(ip, 'login')) return jsonRes(res, { success: false, data: null, message: '登录尝试过于频繁，请稍后再试' });

    var data = loadUsers();
    var user = data.users[username];

    if (!user) {
      return jsonRes(res, { success: false, data: null, message: '用户名或密码错误' });
    }

    if (user.locked_until && Date.now() < new Date(user.locked_until).getTime()) {
      var remaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return jsonRes(res, { success: false, data: null, message: '账户已被锁定，请 ' + remaining + ' 分钟后重试' });
    }

    var bcryptjs = require('bcryptjs');
    if (!bcryptjs.compareSync(password, user.password_hash)) {
      user.failed_attempts = (user.failed_attempts || 0) + 1;
      if (user.failed_attempts >= MAX_LOGIN_ATTEMPTS) {
        user.locked_until = new Date(Date.now() + LOCKOUT_DURATION * 1000).toISOString();
        saveUsers(data);
        return jsonRes(res, { success: false, data: null, message: '账户已被锁定 ' + (LOCKOUT_DURATION / 60) + ' 分钟，请稍后重试' });
      }
      saveUsers(data);
      return jsonRes(res, { success: false, data: null, message: '用户名或密码错误' });
    }

    user.failed_attempts = 0;
    user.locked_until = null;
    saveUsers(data);
    clearRateLimit(ip, 'login');
    createSession(res, user);
    jsonRes(res, { success: true, data: { username: username, role: user.role }, message: '登录成功' });
  });
}

function handleLogout(req, res) {
  if (req.method !== 'POST') return jsonRes(res, { success: false, data: null, message: 'Method not allowed' }, 405);
  destroySession(req, res);
  jsonRes(res, { success: true, data: null, message: '已退出登录' });
}

function handleStatus(req, res) {
  if (req.method !== 'GET') return jsonRes(res, { success: false, data: null, message: 'Method not allowed' }, 405);
  var user = getSession(req);
  if (!user) return jsonRes(res, { success: false, data: null, message: '未登录' });
  jsonRes(res, { success: true, data: { username: user.username, role: user.role, email: user.email } });
}

function handleChangePassword(req, res) {
  var user = requireAuth(req, res);
  if (!user) return;

  readBody(req, function (body) {
    var input;
    try { input = JSON.parse(body); } catch (e) { return jsonRes(res, { success: false, data: null, message: 'Invalid JSON' }); }

    var currentPassword = input.current_password || '';
    var newPassword = input.new_password || '';

    if (!currentPassword || !newPassword) return jsonRes(res, { success: false, data: null, message: '请输入当前密码和新密码' });
    if (newPassword.length < 8) return jsonRes(res, { success: false, data: null, message: '密码长度至少为 8 个字符' });

    var data = loadUsers();
    var userData = data.users[user.username];
    if (!userData) return jsonRes(res, { success: false, data: null, message: '用户不存在' });

    var bcryptjs = require('bcryptjs');
    if (!bcryptjs.compareSync(currentPassword, userData.password_hash)) {
      return jsonRes(res, { success: false, data: null, message: '当前密码错误' });
    }

    userData.password_hash = bcryptjs.hashSync(newPassword, 12);
    saveUsers(data);
    destroySession(req, res);
    jsonRes(res, { success: true, data: null, message: '密码修改成功，请重新登录' });
  });
}

function handleForgotPassword(req, res) {
  if (req.method !== 'POST') return jsonRes(res, { success: false, data: null, message: 'Method not allowed' }, 405);

  readBody(req, function (body) {
    var input;
    try { input = JSON.parse(body); } catch (e) { return jsonRes(res, { success: false, data: null, message: 'Invalid JSON' }); }

    var usernameOrEmail = (input.username_or_email || '').trim();
    var ip = getClientIP(req);

    if (!usernameOrEmail) return jsonRes(res, { success: false, data: null, message: '请输入用户名或邮箱' });
    if (!checkRateLimit(ip, 'reset_request')) return jsonRes(res, { success: false, data: null, message: '请求过于频繁，请稍后再试' });

    var data = loadUsers();
    var foundU = null;

    Object.keys(data.users).forEach(function (uname) {
      var u = data.users[uname];
      if (uname.toLowerCase() === usernameOrEmail.toLowerCase() ||
          (u.email && u.email.toLowerCase() === usernameOrEmail.toLowerCase())) {
        foundU = uname;
      }
    });

    if (!foundU) {
      var dummyToken = generateToken();
      return jsonRes(res, { success: true, data: { reset_token: dummyToken, expires_in: 3600 }, message: '如果账户存在，重置令牌已生成' });
    }

    if (!data.reset_tokens) data.reset_tokens = {};
    var token = generateToken();
    data.reset_tokens[token] = { username: foundU, created_at: Date.now(), expires_at: Date.now() + 3600000 };
    saveUsers(data);

    jsonRes(res, { success: true, data: { reset_token: token, expires_in: 3600 }, message: '重置令牌已生成' });
  });
}

function handleResetPassword(req, res) {
  if (req.method !== 'POST') return jsonRes(res, { success: false, data: null, message: 'Method not allowed' }, 405);

  readBody(req, function (body) {
    var input;
    try { input = JSON.parse(body); } catch (e) { return jsonRes(res, { success: false, data: null, message: 'Invalid JSON' }); }

    var token = (input.token || '').trim();
    var newPassword = input.new_password || '';
    var ip = getClientIP(req);

    if (!token || !newPassword) return jsonRes(res, { success: false, data: null, message: '缺少必要参数' });
    if (newPassword.length < 8) return jsonRes(res, { success: false, data: null, message: '密码长度至少为 8 个字符' });
    if (!checkRateLimit(ip, 'reset_confirm')) return jsonRes(res, { success: false, data: null, message: '请求过于频繁，请稍后再试' });

    var data = loadUsers();
    if (!data.reset_tokens || !data.reset_tokens[token]) {
      return jsonRes(res, { success: false, data: null, message: '重置令牌无效' });
    }

    var tData = data.reset_tokens[token];
    if (Date.now() > tData.expires_at) {
      delete data.reset_tokens[token];
      saveUsers(data);
      return jsonRes(res, { success: false, data: null, message: '重置令牌已过期' });
    }

    var username = tData.username;
    if (!data.users[username]) return jsonRes(res, { success: false, data: null, message: '用户不存在' });

    var bcryptjs = require('bcryptjs');
    data.users[username].password_hash = bcryptjs.hashSync(newPassword, 12);
    data.users[username].failed_attempts = 0;
    data.users[username].locked_until = null;
    delete data.reset_tokens[token];
    saveUsers(data);
    clearRateLimit(ip, 'reset_confirm');

    jsonRes(res, { success: true, data: null, message: '密码重置成功，请使用新密码登录' });
  });
}

function handleUpdateProfile(req, res) {
  var user = requireAuth(req, res);
  if (!user) return;

  readBody(req, function (body) {
    var input;
    try { input = JSON.parse(body); } catch (e) { return jsonRes(res, { success: false, data: null, message: 'Invalid JSON' }); }

    var email = (input.email || '').trim();
    var currentPassword = input.current_password || '';

    if (!currentPassword) return jsonRes(res, { success: false, data: null, message: '请输入当前密码' });
    if (!email) return jsonRes(res, { success: false, data: null, message: '请输入邮箱' });

    var data = loadUsers();
    var userData = data.users[user.username];
    if (!userData) return jsonRes(res, { success: false, data: null, message: '用户不存在' });

    var bcryptjs = require('bcryptjs');
    if (!bcryptjs.compareSync(currentPassword, userData.password_hash)) {
      return jsonRes(res, { success: false, data: null, message: '当前密码错误' });
    }

    userData.email = email;
    saveUsers(data);

    var sessionUser = getSession(req);
    if (sessionUser) sessionUser.email = email;

    jsonRes(res, { success: true, data: { email: email }, message: '设置已更新' });
  });
}

function handleEvents(req, res) {
  var user = requireAuth(req, res);
  if (!user) return;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('data: {"type":"connected"}\n\n');

  sseClients.push(res);

  req.on('close', function () {
    var idx = sseClients.indexOf(res);
    if (idx >= 0) sseClients.splice(idx, 1);
  });
}

function broadcastSSE(data) {
  var json = JSON.stringify(data);
  for (var i = sseClients.length - 1; i >= 0; i--) {
    try { sseClients[i].write('data: ' + json + '\n\n'); } catch (e) { sseClients.splice(i, 1); }
  }
}

var modelListWatcher;
var watchTarget = MODEL_LIST_FILE;
try { watchTarget = fs.realpathSync(MODEL_LIST_FILE); } catch (e) {}
try {
  modelListWatcher = fs.watch(watchTarget, function () {
    broadcastSSE({ type: 'models_updated' });
  });
} catch (e) {}

function handleAPI(req, res, urlPath) {
  var endpoint = urlPath.replace('/admin/api/', '').replace('.php', '');

  if (endpoint === 'login') return handleLogin(req, res);
  if (endpoint === 'logout') return handleLogout(req, res);
  if (endpoint === 'status') return handleStatus(req, res);
  if (endpoint === 'change_password') return handleChangePassword(req, res);
  if (endpoint === 'forgot_password') return handleForgotPassword(req, res);
  if (endpoint === 'reset_password') return handleResetPassword(req, res);

  if (!requireAuth(req, res)) return;

  if (endpoint === 'update_profile') return handleUpdateProfile(req, res);
  if (endpoint === 'events') return handleEvents(req, res);

  if (endpoint === 'list') {
    var list = JSON.parse(fs.readFileSync(MODEL_LIST_FILE, 'utf-8'));
    var models = list.models;
    var messages = list.messages;
    var result = [];
    models.forEach(function (entry, idx) {
      var message = messages[idx] || '';
      if (Array.isArray(entry)) {
        var group = entry[0];
        var subModels = [];
        for (var s = 1; s < entry.length; s++) {
          var subName = entry[s];
          var subInfo = getModelInfo(subName);
          subModels.push({
            id: null, name: subName, group: group,
            textures_count: subInfo.textures_count, has_moc: subInfo.has_moc,
            has_physics: subInfo.has_physics, has_pose: subInfo.has_pose, file_count: subInfo.file_count,
          });
        }
        result.push({ id: String(idx), name: group, group: group, message: message, is_multi: true, sub_models: subModels, has_moc: true });
      } else {
        var info = getModelInfo(entry);
        result.push({
          id: String(idx), name: entry, group: entry.split('/')[0] || entry, message: message,
          is_multi: false, textures_count: info.textures_count, has_moc: info.has_moc,
          has_physics: info.has_physics, has_pose: info.has_pose, file_count: info.file_count,
        });
      }
    });
    return jsonRes(res, { success: true, data: result });
  }

  if (endpoint === 'groups') {
    var groups = [];
    var modelDir = MODEL_DIR;
    if (fs.existsSync(modelDir)) {
      var items = fs.readdirSync(modelDir);
      items.forEach(function (item) {
        if (item === '.' || item === '..') return;
        var full = path.join(modelDir, item);
        if (!fs.statSync(full).isDirectory()) return;
        if (hasModelFiles(full)) groups.push({ name: item, count: 1 });
        else {
          var subItems = fs.readdirSync(full);
          var count = 0;
          subItems.forEach(function (sub) {
            if (hasModelFiles(path.join(full, sub))) count++;
          });
          if (count > 0) groups.push({ name: item, count: count });
        }
      });
    }
    return jsonRes(res, { success: true, data: groups });
  }

  if (endpoint === 'detail') {
    var params = new URL(req.url, 'http://localhost').searchParams;
    var modelName = params.get('model_name');
    if (!modelName) return jsonRes(res, { success: false, data: null, message: 'Missing model_name' });
    var dir = path.join(MODEL_DIR, modelName);
    if (!fs.existsSync(dir)) return jsonRes(res, { success: false, data: null, message: 'Model not found' });
    var files = scanDir(dir);
    var indexPath = path.join(dir, 'index.json');
    var model3Name = findModel3Json(dir);
    var model3Path = model3Name ? path.join(dir, model3Name) : null;
    var configPath = fs.existsSync(indexPath) ? indexPath : model3Path;
    var config = null;
    var textures = [];
    var motions = {};
    if (configPath) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch (e) {}
      if (config) {
        textures = extractTexturesFromConfig(config);
        motions = extractMotionsFromConfig(config);
      }
    }
    return jsonRes(res, { success: true, data: { name: modelName, config: config, files: files, textures: textures, motions: motions } });
  }

  if (endpoint === 'create') {
    readBody(req, function (body) {
      try {
        var input = JSON.parse(body);
        var name = (input.name || '').trim();
        var message = (input.message || '').trim();
        var dirPath = path.join(MODEL_DIR, name);
        if (!name || (!fs.existsSync(dirPath))) return jsonRes(res, { success: false, data: null, message: '模型目录不存在' });
        var list = JSON.parse(fs.readFileSync(MODEL_LIST_FILE, 'utf-8'));
        list.models.push(name);
        list.messages.push(message);
        fs.writeFileSync(MODEL_LIST_FILE, JSON.stringify(list, null, 4));
        jsonRes(res, { success: true, data: { name: name, message: message }, message: 'Created' });
      } catch (e) { jsonRes(res, { success: false, data: null, message: e.message }); }
    });
    return;
  }

  if (endpoint === 'update') {
    readBody(req, function (body) {
      try {
        var input = JSON.parse(body);
        var oldName = (input.old_name || '').trim();
        var newName = (input.new_name || '').trim();
        var message = input.message;
        if (!oldName) return jsonRes(res, { success: false, data: null, message: 'Missing old_name' });
        var list = JSON.parse(fs.readFileSync(MODEL_LIST_FILE, 'utf-8'));
        var found = false;
        for (var i = 0; i < list.models.length; i++) {
          var entry = list.models[i];
          if (Array.isArray(entry)) {
            for (var j = 0; j < entry.length; j++) {
              if (entry[j] === oldName) { found = true; break; }
            }
          } else if (entry === oldName) { found = true; break; }
          if (found) break;
        }
        if (!found) return jsonRes(res, { success: false, data: null, message: 'Model not found' });
        if (newName && newName !== oldName) {
          var oldDir = path.join(MODEL_DIR, oldName);
          var newDir = path.join(MODEL_DIR, newName);
          if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
            fs.renameSync(oldDir, newDir);
          }
          for (var k = 0; k < list.models.length; k++) {
            if (Array.isArray(list.models[k])) {
              for (var l = 0; l < list.models[k].length; l++) {
                if (list.models[k][l] === oldName) list.models[k][l] = newName;
              }
            } else if (list.models[k] === oldName) list.models[k] = newName;
          }
        }
        if (message !== null && message !== undefined) list.messages[i] = message;
        fs.writeFileSync(MODEL_LIST_FILE, JSON.stringify(list, null, 4));
        jsonRes(res, { success: true, data: null, message: 'Updated' });
      } catch (e) { jsonRes(res, { success: false, data: null, message: e.message }); }
    });
    return;
  }

  if (endpoint === 'delete') {
    readBody(req, function (body) {
      try {
        var input = JSON.parse(body);
        var name = (input.name || '').trim();
        var confirm = !!input.confirm;
        if (!name) return jsonRes(res, { success: false, data: null, message: 'Missing name' });
        var list = JSON.parse(fs.readFileSync(MODEL_LIST_FILE, 'utf-8'));
        var foundIdx = -1;
        for (var i = 0; i < list.models.length; i++) {
          if (Array.isArray(list.models[i])) {
            for (var j = 0; j < list.models[i].length; j++) {
              if (list.models[i][j] === name) { foundIdx = i; break; }
            }
          } else if (list.models[i] === name) { foundIdx = i; }
          if (foundIdx >= 0) break;
        }
        if (foundIdx < 0) return jsonRes(res, { success: false, data: null, message: 'Model not found' });
        if (confirm) {
          var dir = path.join(MODEL_DIR, name);
          if (fs.existsSync(dir)) {
            function rmdirRecursive(p) {
              if (!fs.existsSync(p)) return;
              if (fs.statSync(p).isDirectory()) {
                fs.readdirSync(p).forEach(function (f) { rmdirRecursive(path.join(p, f)); });
                fs.rmdirSync(p);
              } else { fs.unlinkSync(p); }
            }
            rmdirRecursive(dir);
          }
        }
        list.models.splice(foundIdx, 1);
        list.messages.splice(foundIdx, 1);
        fs.writeFileSync(MODEL_LIST_FILE, JSON.stringify(list, null, 4));
        jsonRes(res, { success: true, data: null, message: 'Deleted' });
      } catch (e) { jsonRes(res, { success: false, data: null, message: e.message }); }
    });
    return;
  }

  if (endpoint === 'scan-dirs') {
    var result = [];
    var modelDir = MODEL_DIR;
    if (fs.existsSync(modelDir)) {
      var items = fs.readdirSync(modelDir);
      items.forEach(function (item) {
        if (item === '.' || item === '..') return;
        var full = path.join(modelDir, item);
        if (!fs.statSync(full).isDirectory()) return;
        if (hasModelFiles(full)) { result.push(item); return; }
        try {
          var subs = fs.readdirSync(full);
          subs.forEach(function (sub) {
            if (fs.statSync(path.join(full, sub)).isDirectory() && hasModelFiles(path.join(full, sub))) {
              result.push(item + '/' + sub);
            }
          });
        } catch (e) {}
      });
    }
    var list = JSON.parse(fs.readFileSync(MODEL_LIST_FILE, 'utf-8'));
    var registered = {};
    list.models.forEach(function (entry) {
      if (Array.isArray(entry)) {
        for (var i = 0; i < entry.length; i++) registered[entry[i]] = true;
      } else { registered[entry] = true; }
    });
    result = result.filter(function (r) { return !registered[r]; });
    return jsonRes(res, { success: true, data: result });
  }

  if (endpoint === 'upload') {
    return jsonRes(res, { success: false, data: null, message: 'Upload requires PHP server. Please use Apache/Nginx for upload functionality.' });
  }

  jsonRes(res, { success: false, data: null, message: 'Unknown endpoint' }, 404);
}

function handleGetModel(req, res, params) {
  var modelName = params.get('name');
  var modelId = params.get('id');
  var texturesId = params.get('textures_id');

  if (modelId) {
    var parts = modelId.split('-');
    var id = parseInt(parts[0], 10);
    var texId = parseInt(parts[1], 10) || 0;
    var list = JSON.parse(fs.readFileSync(MODEL_LIST_FILE, 'utf-8'));
    var entry = list.models[id - 1];
    if (!entry) { res.writeHead(404); res.end(); return; }
    modelName = Array.isArray(entry) ? entry[0] + '/' + entry[1] : entry;
    if (!modelName) { res.writeHead(404); res.end(); return; }
  }

  if (!modelName) { res.writeHead(404); res.end(); return; }

  var dir = path.join(MODEL_DIR, modelName);
  if (!fs.existsSync(dir)) { res.writeHead(404); res.end(); return; }

  var indexPath = path.join(dir, 'index.json');
  var model3Name = findModel3Json(dir);
  var model3Path = model3Name ? path.join(dir, model3Name) : null;
  var configPath = fs.existsSync(indexPath) ? indexPath : model3Path;
  var json;

  if (configPath) {
    json = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (configPath === model3Path) {
      json = convertModel3ToLegacy(json, modelName);
    }
  } else {
    json = { model: modelName + '.moc' };
  }

  if (json.textures && Array.isArray(json.textures)) {
    json.textures.forEach(function (t, i) {
      json.textures[i] = '../model/' + modelName + '/' + t;
    });
  }
  if (json.model) json.model = '../model/' + modelName + '/' + json.model;
  if (json.pose) json.pose = '../model/' + modelName + '/' + json.pose;
  if (json.physics) json.physics = '../model/' + modelName + '/' + json.physics;
  if (json.motions) {
    Object.keys(json.motions).forEach(function (group) {
      json.motions[group].forEach(function (motion, idx) {
        Object.keys(motion).forEach(function (key) {
          if (key === 'file' || key === 'sound') {
            json.motions[group][idx][key] = '../model/' + modelName + '/' + motion[key];
          }
        });
      });
    });
  }
  if (json.expressions) {
    json.expressions.forEach(function (expr, idx) {
      Object.keys(expr).forEach(function (key) {
        if (key === 'file') {
          json.expressions[idx][key] = '../model/' + modelName + '/' + expr[key];
        }
      });
    });
  }

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(json));
}

var server = http.createServer(function (req, res) {
  var rawPath = new URL(req.url, 'http://localhost').pathname;
  var urlPath;
  try { urlPath = decodeURIComponent(rawPath); } catch (e) { urlPath = rawPath; }

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (urlPath.startsWith('/admin/api/')) {
    return handleAPI(req, res, urlPath);
  }

  if (urlPath === '/get/' || urlPath === '/get') {
    return handleGetModel(req, res, new URL(req.url, 'http://localhost').searchParams);
  }

  if (urlPath === '/live2d.min.js') {
    var sdkPath = path.join(BASE, 'admin', 'assets', 'js', 'live2d.min.js');
    if (fs.existsSync(sdkPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(sdkPath).pipe(res);
      return;
    }
  }

  var filePath;
  if (urlPath === '/admin' || urlPath === '/admin/') {
    filePath = path.join(BASE, 'admin', 'index.html');
  } else {
    filePath = path.join(BASE, urlPath);
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  var ext = path.extname(filePath).toLowerCase();
  var mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(8080, function () {
  console.log('Dev server running at http://localhost:8080/admin/');
});
