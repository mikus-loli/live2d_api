var http = require('http');
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var BASE = path.join(__dirname, '..');
var MODEL_DIR = path.join(BASE, 'model');
var USERS_FILE = path.join(__dirname, 'api', 'users.json');

// 统计模型皮肤数量
function countModelSkins(modelPath) {
  var texDir = path.join(modelPath, 'textures');
  if (fs.existsSync(texDir)) {
    try {
      var files = fs.readdirSync(texDir).filter(function (f) {
        return /\.(png|jpg|jpeg|webp|avif)$/i.test(f);
      });
      return files.length || 1;
    } catch (e) {}
  }
  return 1;
}

// 从文件系统扫描构建模型列表（替代 model_list.json）
function buildModelListFromFilesystem() {
  var models = [];
  var messages = [];
  var skinCounts = [];
  var previews = [];
  if (!fs.existsSync(MODEL_DIR)) return { models: [], messages: [], skin_counts: [], previews: [] };
  try {
    var entries = fs.readdirSync(MODEL_DIR);
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (entry === '.' || entry === '..' || entry.startsWith('.') || entry === '.gitkeep') continue;
      var entryPath = path.join(MODEL_DIR, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;
      var subFiles;
      try { subFiles = fs.readdirSync(entryPath); } catch (e) { continue; }
      var hasConfig = false;
      for (var j = 0; j < subFiles.length; j++) {
        if (subFiles[j] === 'index.json' || subFiles[j].endsWith('.model3.json')) {
          hasConfig = true;
          break;
        }
      }
      // 检测封面图
      function findPreview(modelDir) {
        var exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
        for (var e = 0; e < exts.length; e++) {
          if (fs.existsSync(path.join(modelDir, 'preview' + exts[e]))) return 'preview' + exts[e];
        }
        return null;
      }
      if (hasConfig) {
        var modelRelPath = entry;
        models.push(modelRelPath);
        messages.push(entry);
        skinCounts.push(countModelSkins(path.join(MODEL_DIR, entry)));
        var pvFile = findPreview(path.join(MODEL_DIR, entry));
        previews.push(pvFile ? ('model/' + modelRelPath.replace(/\\/g, '/') + '/' + pvFile) : null);
      } else {
        var subDirs = [];
        for (var k = 0; k < subFiles.length; k++) {
          var subEntry = subFiles[k];
          if (subEntry === '.' || subEntry === '..' || subEntry.startsWith('.') || subEntry === 'general') continue;
          var subPath = path.join(entryPath, subEntry);
          if (!fs.statSync(subPath).isDirectory()) continue;
          try {
            var modelFiles = fs.readdirSync(subPath);
            for (var l = 0; l < modelFiles.length; l++) {
              if (modelFiles[l] === 'index.json' || modelFiles[l].endsWith('.model3.json')) {
                subDirs.push(entry + '/' + subEntry);
                break;
              }
            }
          } catch (e) {}
        }
        if (subDirs.length === 1) {
          models.push(subDirs[0]);
          messages.push(entry);
          skinCounts.push(countModelSkins(path.join(MODEL_DIR, subDirs[0])));
          var pvFile = findPreview(path.join(MODEL_DIR, subDirs[0]));
          previews.push(pvFile ? ('model/' + subDirs[0].replace(/\\/g, '/') + '/' + pvFile) : null);
        } else if (subDirs.length > 1) {
          models.push(subDirs);
          messages.push(entry);
          var groupSkins = [];
          var groupPreviews = [];
          for (var m = 0; m < subDirs.length; m++) {
            groupSkins.push(countModelSkins(path.join(MODEL_DIR, subDirs[m])));
            var pvFile2 = findPreview(path.join(MODEL_DIR, subDirs[m]));
            groupPreviews.push(pvFile2 ? ('model/' + subDirs[m].replace(/\\/g, '/') + '/' + pvFile2) : null);
          }
          skinCounts.push(groupSkins);
          previews.push(groupPreviews);
        }
      }
    }
  } catch (e) {}
  return { models: models, messages: messages, skin_counts: skinCounts, previews: previews };
}

// 获取模型列表（优先用缓存）
function getModelList() {
  var now = Date.now();
  if (modelListCache && (now - modelListCacheTime) < MODEL_LIST_CACHE_TTL) {
    return modelListCache;
  }
  var list = buildModelListFromFilesystem();
  modelListCache = list;
  modelListCacheTime = now;
  return list;
}

var MAX_LOGIN_ATTEMPTS = 5;
var LOCKOUT_DURATION = 900;
var SESSION_LIFETIME = 86400;
var TOKEN_BYTES = 32;

var sessions = {};
var rateLimitStore = {};
var usersCache = null;
var usersCacheTime = 0;
var wsClients = [];
var modelListCache = null;
var modelListCacheTime = 0;
var MODEL_LIST_CACHE_TTL = 5000; // 5秒缓存

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

function isPathSafe(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.indexOf('..') >= 0) return false;
  if (name.charAt(0) === '/') return false;
  return /^[a-zA-Z0-9_\-\/\u4e00-\u9fff\.]+$/.test(name);
}

function jsonRes(res, data, statusCode) {
  var sc = statusCode || 200;
  res.writeHead(sc, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
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
  var info = { textures_count: 0, skins_count: 0, has_moc: false, has_physics: false, has_pose: false, file_count: 0, is_cubism4: false };
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return info;
  var files = scanDir(dir);
  info.file_count = files.length;
  files.forEach(function (f) {
    var ext = path.extname(f.name).toLowerCase();
    var base = path.basename(f.name);
    if (ext === '.moc' || ext === '.moc3') info.has_moc = true;
    if (ext === '.moc3') info.is_cubism4 = true;
    if (/\.model3\.json$/i.test(base)) info.is_cubism4 = true;
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
  var orderPath = path.join(dir, 'textures_order.json');
  if (fs.existsSync(cachePath)) {
    try {
      var cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (Array.isArray(cache) && cache.length > 0) {
        info.skins_count = cache.length;
      }
    } catch (e) {}
  } else if (fs.existsSync(orderPath)) {
    try {
      var order = JSON.parse(fs.readFileSync(orderPath, 'utf-8'));
      if (Array.isArray(order) && order.length > 0) {
        var combos = generateTextureCombinations(dir, order);
        info.skins_count = combos.length;
      }
    } catch (e) {}
  }
  // 检测封面图
  var exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
  for (var ei = 0; ei < exts.length; ei++) {
    var previewPath = path.join(dir, 'preview' + exts[ei]);
    if (fs.existsSync(previewPath)) {
      info.preview = 'model/' + modelName + '/preview' + exts[ei];
      break;
    }
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
  if (forwarded) {
    var ips = forwarded.split(',');
    return ips[ips.length - 1].trim();
  }
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
    user: { username: user.username, role: user.role },
    created: Date.now(),
  };
  var secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    'admin_token=' + token + '; Path=/admin/; HttpOnly; SameSite=Strict; Max-Age=' + SESSION_LIFETIME + secure);
  return token;
}

function destroySession(req, res) {
  var cookies = parseCookies(req);
  var token = cookies['admin_token'];
  if (token && sessions[token]) delete sessions[token];
  res.setHeader('Set-Cookie', 'admin_token=; Path=/admin/; HttpOnly; SameSite=Strict; Max-Age=0');
}

function requireAuth(req, res) {
  var user = getSession(req);
  if (!user) {
    jsonRes(res, { success: false, data: null, message: '未登录或会话已过期' }, 401);
    return null;
  }
  return user;
}

var MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB 请求体大小限制

function readBody(req, cb) {
  var body = '';
  var size = 0;
  req.on('data', function (c) {
    size += c.length;
    if (size > MAX_BODY_SIZE) {
      req.destroy();
      return;
    }
    body += c;
  });
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
  jsonRes(res, { success: true, data: { username: user.username, role: user.role } });
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

function handleUpdateProfile(req, res) {
  var user = requireAuth(req, res);
  if (!user) return;

  readBody(req, function (body) {
    var input;
    try { input = JSON.parse(body); } catch (e) { return jsonRes(res, { success: false, data: null, message: 'Invalid JSON' }); }

    var newUsername = (input.new_username || '').trim();
    var currentPassword = input.current_password || '';

    if (!currentPassword) return jsonRes(res, { success: false, data: null, message: '请输入当前密码' });
    if (!newUsername) return jsonRes(res, { success: false, data: null, message: '请输入新用户名' });
    if (newUsername.length < 2) return jsonRes(res, { success: false, data: null, message: '用户名至少 2 个字符' });
    if (!/^[a-zA-Z0-9_\u4e00-\u9fff]+$/.test(newUsername)) return jsonRes(res, { success: false, data: null, message: '用户名只能包含字母、数字、下划线和中文' });

    var data = loadUsers();
    var oldUsername = user.username;
    var userData = data.users[oldUsername];
    if (!userData) return jsonRes(res, { success: false, data: null, message: '用户不存在' });

    var bcryptjs = require('bcryptjs');
    if (!bcryptjs.compareSync(currentPassword, userData.password_hash)) {
      return jsonRes(res, { success: false, data: null, message: '当前密码错误' });
    }

    if (newUsername !== oldUsername && data.users[newUsername]) {
      return jsonRes(res, { success: false, data: null, message: '该用户名已被占用' });
    }

    if (newUsername !== oldUsername) {
      data.users[newUsername] = userData;
      data.users[newUsername].username = newUsername;
      delete data.users[oldUsername];
    }
    saveUsers(data);

    var sessionUser = getSession(req);
    if (sessionUser) sessionUser.username = newUsername;

    jsonRes(res, { success: true, data: { username: newUsername }, message: '用户名已更新' });
  });
}

function handleTextureConfig(req, res, modelName, textureId) {
  if (!isPathSafe(modelName)) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Invalid model name' }));
    return;
  }
  var dir = path.join(MODEL_DIR, modelName);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Model not found' }));
    return;
  }

  var indexPath = path.join(dir, 'index.json');
  var model3Name = findModel3Json(dir);
  var configPath = fs.existsSync(indexPath) ? indexPath : (model3Name ? path.join(dir, model3Name) : null);

  if (!configPath) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Config not found' }));
    return;
  }

  try {
    var config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    var cachePath = path.join(dir, 'textures.cache');
    var orderPath = path.join(dir, 'textures_order.json');
    var textures = [];
    var isMultiTexture = false;

    if (fs.existsSync(cachePath)) {
      var cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (Array.isArray(cache) && cache.length > 0) {
        if (Array.isArray(cache[0])) {
          textures = cache;
          isMultiTexture = true;
        } else if (typeof cache[0] === 'string') {
          textures = cache;
        }
      }
    } else if (fs.existsSync(orderPath)) {
      var order = JSON.parse(fs.readFileSync(orderPath, 'utf-8'));
      if (Array.isArray(order) && order.length > 0) {
        var combos = generateTextureCombinations(dir, order);
        if (combos.length > 0) {
          textures = combos;
          isMultiTexture = true;
        }
      }
    }

    if (textures.length === 0) {
      // 自动扫描 textures 目录作为备选
      var texDir = path.join(dir, 'textures');
      if (fs.existsSync(texDir)) {
        try {
          var texFiles = fs.readdirSync(texDir).filter(function (f) {
            return /\.(png|jpg|jpeg|webp|avif)$/i.test(f);
          });
          if (texFiles.length > 0) {
            textures = texFiles.map(function (f) { return ['textures/' + f]; });
            isMultiTexture = true;
          }
        } catch (e) {}
      }
    }

    if (textures.length === 0) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      });
      res.end(JSON.stringify(config));
      return;
    }

    if (textureId < 1) textureId = 1;
    if (textureId > textures.length) textureId = 1;

    var selectedTextures = textures[textureId - 1];
    if (isMultiTexture) {
      if (config.FileReferences && config.FileReferences.Textures) {
        config.FileReferences.Textures = selectedTextures;
      } else if (config.textures) {
        config.textures = selectedTextures;
      }
    } else {
      if (config.FileReferences && config.FileReferences.Textures) {
        config.FileReferences.Textures = [selectedTextures];
      } else if (config.textures) {
        config.textures = [selectedTextures];
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60',
    });
    res.end(JSON.stringify(config));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Failed to read config' }));
  }
}

function generateTextureCombinations(dir, order) {
  var result = [];
  var textureDirs = [];

  for (var i = 0; i < order.length; i++) {
    var group = order[i];
    var groupFiles = [];
    for (var j = 0; j < group.length; j++) {
      var texDir = path.join(dir, group[j]);
      if (fs.existsSync(texDir) && fs.statSync(texDir).isDirectory()) {
        var files = fs.readdirSync(texDir).filter(function(f) {
          return /\.(png|jpg|avif)$/i.test(f);
        });
        files.sort();
        var paths = files.map(function(f) { return group[j] + '/' + f; });
        groupFiles.push(paths);
      }
    }
    if (groupFiles.length > 0) {
      textureDirs.push(groupFiles);
    }
  }

  if (textureDirs.length === 0) return result;

  function combine(groups, prefix) {
    if (groups.length === 0) {
      result.push(prefix);
      return;
    }
    var current = groups[0];
    for (var i = 0; i < current.length; i++) {
      combine(groups.slice(1), prefix.concat(current[i]));
    }
  }

  var allGroups = [];
  for (var i = 0; i < textureDirs.length; i++) {
    var g = textureDirs[i];
    var combined = [];
    for (var j = 0; j < g.length; j++) {
      combined = combined.concat(g[j]);
    }
    allGroups.push(combined);
  }

  combine(allGroups, []);
  return result;
}

function broadcastWS(data) {
  var json = JSON.stringify(data);
  for (var i = wsClients.length - 1; i >= 0; i--) {
    try { wsClients[i].send(json); } catch (e) { wsClients.splice(i, 1); }
  }
}

function invalidateModelListCache() {
  modelListCache = null;
  modelListCacheTime = 0;
}

// 定期清理过期 session 和速率限制
setInterval(function () {
  var now = Date.now();
  Object.keys(sessions).forEach(function (token) {
    if (now - sessions[token].created > SESSION_LIFETIME * 1000) {
      delete sessions[token];
    }
  });
  Object.keys(rateLimitStore).forEach(function (action) {
    Object.keys(rateLimitStore[action]).forEach(function (ip) {
      if (now - rateLimitStore[action][ip].firstAttempt > 60000) {
        delete rateLimitStore[action][ip];
      }
    });
    if (Object.keys(rateLimitStore[action]).length === 0) {
      delete rateLimitStore[action];
    }
  });
}, 300000);

// 模型列表基于文件系统实时扫描，缓存 5s 自动过期，无需文件监视

var UPLOAD_MAX_SIZE = 50 * 1024 * 1024;
var ALLOWED_EXTENSIONS = ['moc', 'moc3', 'json', 'mtn', 'png', 'jpg', 'avif'];

function validateExtension(filename) {
  if (filename.indexOf('.exp3.json') >= 0) return true;
  var ext = path.extname(filename).toLowerCase().replace('.', '');
  return ALLOWED_EXTENSIONS.indexOf(ext) >= 0;
}

function parseMultipart(req, callback) {
  var contentType = req.headers['content-type'] || '';
  var boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  if (!boundaryMatch) return callback(new Error('Invalid content-type'));

  var boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]);
  var parts = [];
  var buffers = [];
  var totalLength = 0;

  req.on('data', function (chunk) {
    totalLength += chunk.length;
    if (totalLength > UPLOAD_MAX_SIZE + 1024 * 1024) {
      req.destroy();
      callback(new Error('File size exceeds maximum allowed size'));
      return;
    }
    buffers.push(chunk);
  });

  req.on('end', function () {
    var fullBuffer = Buffer.concat(buffers, totalLength);
    var boundaryBuf = Buffer.from(boundary);
    var start = 0;

    while (start < fullBuffer.length) {
      var bIdx = fullBuffer.indexOf(boundaryBuf, start);
      if (bIdx < 0) break;

      var nextBIdx = fullBuffer.indexOf(boundaryBuf, bIdx + boundaryBuf.length);
      if (nextBIdx < 0) break;

      var partData = fullBuffer.slice(bIdx + boundaryBuf.length, nextBIdx);
      if (partData.length > 0 && partData[0] === 0x0d) partData = partData.slice(2);

      var headerEnd = partData.indexOf('\r\n\r\n');
      if (headerEnd < 0) { start = nextBIdx; continue; }

      var headerStr = partData.slice(0, headerEnd).toString('utf-8');
      var body = partData.slice(headerEnd + 4);
      if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
        body = body.slice(0, -2);
      }

      var nameMatch = headerStr.match(/name="([^"]+)"/);
      var filenameMatch = headerStr.match(/filename="([^"]+)"/);
      if (!nameMatch) { start = nextBIdx; continue; }

      parts.push({
        name: nameMatch[1],
        filename: filenameMatch ? filenameMatch[1] : null,
        data: body,
        value: filenameMatch ? null : body.toString('utf-8'),
      });

      start = nextBIdx;
    }

    callback(null, parts);
  });

  req.on('error', function (e) { callback(e); });
}

function extractZipInMemory(zipPath, destDir) {
  var AdmZip;
  try { AdmZip = require('adm-zip'); } catch (e) { return false; }

  var zip = new AdmZip(zipPath);
  var entries = zip.getEntries();

  entries.forEach(function (entry) {
    if (entry.isDirectory) return;
    var entryName = entry.entryName;
    if (!validateExtension(entryName)) return;

    var destPath = path.join(destDir, entryName);
    var resolvedDest = path.resolve(destPath);
    if (!resolvedDest.startsWith(path.resolve(destDir) + path.sep) && resolvedDest !== path.resolve(destDir)) return;
    var destSubDir = path.dirname(destPath);
    if (!fs.existsSync(destSubDir)) {
      fs.mkdirSync(destSubDir, { recursive: true });
    }
    fs.writeFileSync(destPath, entry.getData());
  });

  return true;
}

function extractZipManual(zipPath, destDir) {
  var zlib = require('zlib');

  var buf = fs.readFileSync(zipPath);
  var sig = buf.readUInt32LE(0);
  if (sig !== 0x04034b50) return false;

  var offset = 0;
  while (offset < buf.length - 4) {
    var sig2 = buf.readUInt32LE(offset);
    if (sig2 !== 0x04034b50) break;

    var fnLen = buf.readUInt16LE(offset + 26);
    var extraLen = buf.readUInt16LE(offset + 28);
    var compMethod = buf.readUInt16LE(offset + 8);
    var compSize = buf.readUInt32LE(offset + 18);
    var uncompSize = buf.readUInt32LE(offset + 22);
    var fname = buf.slice(offset + 30, offset + 30 + fnLen).toString('utf-8');

    if (fname.indexOf('__MACOSX') >= 0 || fname.indexOf('.DS_Store') >= 0 || fname.charAt(fname.length - 1) === '/') {
      offset += 30 + fnLen + extraLen + compSize;
      continue;
    }

    if (!validateExtension(fname)) {
      offset += 30 + fnLen + extraLen + compSize;
      continue;
    }

    var dataStart = offset + 30 + fnLen + extraLen;
    var compData = buf.slice(dataStart, dataStart + compSize);
    var fileData;

    if (compMethod === 0) {
      fileData = compData;
    } else if (compMethod === 8) {
      fileData = zlib.inflateRawSync(compData);
    } else {
      offset += 30 + fnLen + extraLen + compSize;
      continue;
    }

    var destPath = path.join(destDir, fname);
    var resolvedDest = path.resolve(destPath);
    if (!resolvedDest.startsWith(path.resolve(destDir) + path.sep) && resolvedDest !== path.resolve(destDir)) {
      offset += 30 + fnLen + extraLen + compSize;
      continue;
    }
    var destSubDir = path.dirname(destPath);
    if (!fs.existsSync(destSubDir)) {
      fs.mkdirSync(destSubDir, { recursive: true });
    }
    fs.writeFileSync(destPath, fileData);

    offset += 30 + fnLen + extraLen + compSize;
  }

  return true;
}

function generateIndexJson(modelDir) {
  var files = scanDir(modelDir);
  var textures = [];
  var mocFile = null;
  var physicsFile = null;

  files.forEach(function (f) {
    var ext = path.extname(f.name).toLowerCase().replace('.', '');
    if (ext === 'png' || ext === 'jpg') textures.push(f.name);
    if (ext === 'moc' && !mocFile) mocFile = f.name;
    if (f.name === 'physics.json' && !physicsFile) physicsFile = f.name;
  });

  var index = {
    version: '1.0.0',
    model: mocFile || 'model.moc',
    textures: textures,
  };
  if (physicsFile) index.physics = physicsFile;
  index.layout = { center_x: 0.0, center_y: -0.05, width: 2.0 };

  fs.writeFileSync(path.join(modelDir, 'index.json'), JSON.stringify(index, null, 4));
  return index;
}

function handleUpload(req, res) {
  if (req.method !== 'POST') return jsonRes(res, { success: false, data: null, message: 'Method not allowed' }, 405);

  var contentType = req.headers['content-type'] || '';
  if (contentType.indexOf('multipart/form-data') < 0) {
    return jsonRes(res, { success: false, data: null, message: 'Content-Type must be multipart/form-data' });
  }

  parseMultipart(req, function (err, parts) {
    if (err) return jsonRes(res, { success: false, data: null, message: err.message });

    var filePart = null;
    var modelName = '';

    parts.forEach(function (p) {
      if (p.name === 'file' && p.filename) filePart = p;
      if (p.name === 'model_name') modelName = (p.value || '').trim();
    });

    if (!filePart) return jsonRes(res, { success: false, data: null, message: 'No file uploaded' });
    if (!modelName) return jsonRes(res, { success: false, data: null, message: 'model_name is required' });
    // 清理模型名称
    modelName = modelName.replace(/[^a-zA-Z0-9_\-\/\u4e00-\u9fff]/g, '');
    if (!modelName) return jsonRes(res, { success: false, data: null, message: 'Invalid model name' });
    if (filePart.data.length > UPLOAD_MAX_SIZE) return jsonRes(res, { success: false, data: null, message: 'File size exceeds maximum allowed size (50MB)' });

    var modelDir = path.join(MODEL_DIR, modelName);

    if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

    var originalName = filePart.filename;
    var ext = path.extname(originalName).toLowerCase().replace('.', '');
    var uploadedFiles = [];

    if (ext === 'zip') {
      var tmpDir = path.join(require('os').tmpdir(), 'live2d_upload_' + Date.now() + '_' + Math.random().toString(36).slice(2));
      fs.mkdirSync(tmpDir, { recursive: true });

      var tmpZip = path.join(tmpDir, 'upload.zip');
      fs.writeFileSync(tmpZip, filePart.data);

      var extractOk = extractZipInMemory(tmpZip, tmpDir + '_extracted');
      if (!extractOk) {
        try { extractOk = extractZipManual(tmpZip, tmpDir + '_extracted'); } catch (e) { extractOk = false; }
      }
      if (!extractOk) {
        try { fs.rmSync ? fs.rmSync(tmpDir, { recursive: true }) : rmdirRecursiveSync(tmpDir); } catch (e) {}
        try { fs.rmSync ? fs.rmSync(tmpDir + '_extracted', { recursive: true }) : rmdirRecursiveSync(tmpDir + '_extracted'); } catch (e) {}
        return jsonRes(res, { success: false, data: null, message: 'Failed to extract zip file. Install adm-zip for zip support: npm install adm-zip' });
      }

      var extractDir = tmpDir + '_extracted';
      var items = fs.readdirSync(extractDir);
      var singleDir = null;
      items.forEach(function (item) {
        var itemPath = path.join(extractDir, item);
        if (fs.statSync(itemPath).isDirectory() && !singleDir) singleDir = itemPath;
      });
      if (singleDir && items.length <= 3) extractDir = singleDir;

      var zipFiles = scanDir(extractDir);
      zipFiles.forEach(function (zf) {
        if (!validateExtension(zf.name)) return;
        var srcPath = path.join(extractDir, zf.name);
        var destPath = path.join(modelDir, zf.name);
        var destSubDir = path.dirname(destPath);
        if (!fs.existsSync(destSubDir)) fs.mkdirSync(destSubDir, { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        uploadedFiles.push(zf.name);
      });

      try { fs.rmSync ? fs.rmSync(tmpDir, { recursive: true }) : rmdirRecursiveSync(tmpDir); } catch (e) {}
      try { fs.rmSync ? fs.rmSync(tmpDir + '_extracted', { recursive: true }) : rmdirRecursiveSync(tmpDir + '_extracted'); } catch (e) {}
    } else {
      if (!validateExtension(originalName)) {
        return jsonRes(res, { success: false, data: null, message: 'File type not allowed: ' + ext });
      }
      var destPath = path.join(modelDir, path.basename(originalName));
      fs.writeFileSync(destPath, filePart.data);
      uploadedFiles.push(path.basename(originalName));
    }

    var indexPath = path.join(modelDir, 'index.json');
    var indexGenerated = false;
    if (!fs.existsSync(indexPath) && uploadedFiles.length > 0) {
      generateIndexJson(modelDir);
      indexGenerated = true;
    }

    var allFiles = scanDir(modelDir);

    jsonRes(res, {
      success: true,
      data: {
        model_name: modelName,
        uploaded_files: uploadedFiles,
        all_files: allFiles,
        index_generated: indexGenerated,
      },
      message: 'File(s) uploaded successfully',
    });
  });
}

function handlePublicAPI(req, res, urlPath) {
  var parsedUrl = new URL(urlPath, 'http://localhost');
  var pathname = parsedUrl.pathname.replace(/\/$/, '');
  var query = Object.fromEntries(parsedUrl.searchParams.entries());

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // /add/ - 更新皮肤缓存
  if (pathname === '/add') {
    // 简单实现：扫描模型目录更新缓存
    return jsonRes(res, { success: true, message: 'Cache update not supported in Node.js mode' });
  }

  var modelName = query.name;
  var texturesId = parseInt(query.textures_id || '0', 10);
  var id = query.id;

  // 通过 id 解析模型名称
  if (!modelName && id) {
    var parts = String(id).split('-');
    if (parts.length > 2) return jsonRes(res, { error: 'invalid id format' }, 400);
    var groupId = parseInt(parts[0], 10) - 1;
    var texId = parts[1] ? parseInt(parts[1], 10) : 0;
    var list = getModelList();
    var models = list.models || [];
    if (groupId < 0 || groupId >= models.length) return jsonRes(res, { error: 'model not found' }, 404);
    var entry = models[groupId];
    if (Array.isArray(entry)) {
      modelName = texId > 0 ? entry[(texId - 1) % entry.length] : entry[0];
      texturesId = texId;
    } else {
      modelName = entry;
      texturesId = texId;
    }
  }

  if (!modelName) return jsonRes(res, { error: 'name or id required' }, 400);
  if (!isPathSafe(modelName)) return jsonRes(res, { error: 'invalid model name' }, 400);

  var modelDir = path.join(MODEL_DIR, modelName);
  if (!fs.existsSync(modelDir)) return jsonRes(res, { error: 'model not found' }, 404);

  // /rand/ 和 /switch/ - 模型切换
  if (pathname === '/rand' || pathname === '/switch') {
    var list2 = getModelList();
    var models2 = list2.models || [];
    var currentGroup = -1;
    for (var gi = 0; gi < models2.length; gi++) {
      var e = models2[gi];
      if (e === modelName || (Array.isArray(e) && e.indexOf(modelName) >= 0)) {
        currentGroup = gi;
        break;
      }
    }
    if (currentGroup < 0) return jsonRes(res, { error: 'model not in list' }, 404);

    var nextGroup;
    if (pathname === '/rand') {
      nextGroup = Math.floor(Math.random() * models2.length);
    } else {
      nextGroup = (currentGroup + 1) % models2.length;
    }
    var nextEntry = models2[nextGroup];
    var nextName = Array.isArray(nextEntry) ? nextEntry[0] : nextEntry;
    return jsonRes(res, { model: { id: nextGroup + 1, name: nextName } });
  }

  // /rand_textures/ 和 /switch_textures/ - 皮肤切换
  if (pathname === '/rand_textures' || pathname === '/switch_textures') {
    var textures = loadTexturesCache(modelDir);
    if (textures.length <= 1) return jsonRes(res, { model: { id: query.id || '1-0', name: modelName }, textures: textures });
    var currentTex = texturesId;
    var nextTex;
    if (pathname === '/rand_textures') {
      nextTex = Math.floor(Math.random() * textures.length);
    } else {
      nextTex = (currentTex + 1) % textures.length;
    }
    return jsonRes(res, { model: { id: (query.id || '1').split('-')[0] + '-' + nextTex, name: modelName }, textures_id: nextTex });
  }

  // /skins/ - 获取模型的皮肤列表
  if (pathname === '/skins') {
    var skinList = [];
    var texs = loadTexturesCache(modelDir);
    for (var si = 0; si < texs.length; si++) {
      var t = texs[si];
      var ts = Array.isArray(t) ? t : [t];
      var nm = Array.isArray(t) ? 'Skin ' + (si + 1) : path.basename(String(t), path.extname(String(t)));
      skinList.push({ id: si + 1, textures: ts, name: nm });
    }
    return jsonRes(res, { model_name: modelName, skins_count: skinList.length, skins: skinList });
  }

  // /get/ - 获取模型配置
  var config = loadModelConfig(modelDir, modelName);
  if (!config) return jsonRes(res, { error: 'model config not found' }, 404);

  // Cubism 4 模型：移除 physics/pose/expressions，Cubism 2 SDK 不兼容
  var isCubism4 = fs.readdirSync(modelDir).some(function (f) { return /\.model3\.json$/i.test(f); });
  if (isCubism4) {
    delete config.physics;
    delete config.pose;
    delete config.expressions;
  }

  // 应用皮肤
  if (texturesId > 0) {
    var textures = loadTexturesCache(modelDir);
    if (textures[texturesId]) {
      config.textures = Array.isArray(textures[texturesId]) ? textures[texturesId] : [textures[texturesId]];
    }
  }

  // 将相对路径转为绝对路径（使用 ../model/ 前缀，因为 Live2D 库从 /get/ 解析相对路径）
  // 对路径各段进行 URL 编码，避免中文等非 ASCII 字符被 Live2D 库双重编码
  var encodedName = modelName.split('/').map(encodeURIComponent).join('/');
  var prefix = '../model/' + encodedName + '/';
  
  function encodePathSegments(filePath) {
    return filePath.split('/').map(encodeURIComponent).join('/');
  }
  
  config.textures = (config.textures || []).map(function (t) { return prefix + encodePathSegments(t); });
  if (config.model) config.model = prefix + encodePathSegments(config.model);
  if (config.physics) config.physics = prefix + encodePathSegments(config.physics);
  if (config.pose) config.pose = prefix + encodePathSegments(config.pose);
  if (config.motions) {
    Object.keys(config.motions).forEach(function (group) {
      config.motions[group].forEach(function (m) {
        if (m.file) m.file = prefix + encodePathSegments(m.file);
        if (m.sound) m.sound = prefix + encodePathSegments(m.sound);
      });
    });
  }
  if (config.expressions) {
    config.expressions.forEach(function (e) {
      if (e.file) e.file = prefix + encodePathSegments(e.file);
    });
  }

  // 标注 Cubism 4 模型
  if (isCubism4) {
    var files = fs.readdirSync(modelDir);
    for (var fi2 = 0; fi2 < files.length; fi2++) {
      if (/\.model3\.json$/i.test(files[fi2])) {
        config.model3 = files[fi2];
        break;
      }
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(config));
}

function loadTexturesCache(modelDir) {
  var cacheFile = path.join(modelDir, 'textures.cache');
  if (fs.existsSync(cacheFile)) {
    try { return JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch (e) {}
  }
  // 自动扫描 textures 目录，每个文件单独为一个皮肤
  var texDir = path.join(modelDir, 'textures');
  if (fs.existsSync(texDir)) {
    var files = fs.readdirSync(texDir).filter(function (f) {
      return /\.(png|jpg|jpeg|webp|avif)$/i.test(f);
    });
    if (files.length > 0) return files.map(function (f) { return 'textures/' + f; });  // 带 textures/ 前缀
  }
  return [];
}

function loadModelConfig(modelDir, modelName) {
  // 尝试 index.json (Cubism 2)
  var indexFile = path.join(modelDir, 'index.json');
  if (fs.existsSync(indexFile)) {
    try {
      var cfg = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      // 验证 model 文件存在，否则 index.json 可能是 Cubism 4 的占位文件
      if (cfg.model && fs.existsSync(path.join(modelDir, cfg.model))) {
        return cfg;
      }
    } catch (e) {}
  }
  // 尝试 .model3.json (Cubism 4)
  var files = fs.readdirSync(modelDir);
  for (var i = 0; i < files.length; i++) {
    if (/\.model3\.json$/i.test(files[i])) {
      try {
        var m3 = JSON.parse(fs.readFileSync(path.join(modelDir, files[i]), 'utf-8'));
        var ref = m3.FileReferences || {};
        var converted = {};
        if (ref.Moc) converted.model = ref.Moc;
        if (ref.Textures) converted.textures = ref.Textures;
        if (ref.Physics) converted.physics = ref.Physics;
        if (ref.Pose) converted.pose = ref.Pose;
        if (ref.Motions) {
          converted.motions = {};
          Object.keys(ref.Motions).forEach(function (group) {
            converted.motions[group] = ref.Motions[group].map(function (m) {
              var entry = {};
              if (m.File) entry.file = m.File;
              if (m.Sound) entry.sound = m.Sound;
              return entry;
            });
          });
        }
        if (ref.Expressions) {
          converted.expressions = ref.Expressions.map(function (e) {
            var entry = {};
            if (e.File) entry.file = e.File;
            if (e.Name) entry.name = e.Name;
            return entry;
          });
        }
        return converted;
      } catch (e) {}
    }
  }
  return null;
}

function handleAPI(req, res, urlPath) {
  var endpoint = urlPath.replace('/admin/api/', '').replace('.php', '');

  if (endpoint === 'login') return handleLogin(req, res);
  if (endpoint === 'logout') return handleLogout(req, res);
  if (endpoint === 'status') return handleStatus(req, res);
  if (endpoint === 'change_password') return handleChangePassword(req, res);
  if (!requireAuth(req, res)) return;

  if (endpoint === 'update_profile') return handleUpdateProfile(req, res);

  if (endpoint === 'list') {
    var list = getModelList();
    var models = list.models;
    var messages = list.messages;
    var result = [];
    models.forEach(function (entry, idx) {
      var message = messages[idx] || '';
      if (Array.isArray(entry)) {
        var firstPath = entry[0];
        var group = firstPath.split('/')[0];
        var subModels = [];
        for (var s = 0; s < entry.length; s++) {
          var subName = entry[s];
          var subDir = path.join(MODEL_DIR, subName);
          if (!fs.existsSync(subDir)) continue;
          var subInfo = getModelInfo(subName);
          subModels.push({
            id: null, name: subName, group: group,
            textures_count: subInfo.textures_count, skins_count: subInfo.skins_count,
            has_moc: subInfo.has_moc, has_physics: subInfo.has_physics, has_pose: subInfo.has_pose,
            file_count: subInfo.file_count, is_cubism4: subInfo.is_cubism4, preview: subInfo.preview,
          });
        }
        if (subModels.length === 0) return;
        result.push({ id: String(idx), name: group, group: group, message: message, is_multi: true, sub_models: subModels, has_moc: true });
      } else {
        var modelDir = path.join(MODEL_DIR, entry);
        if (!fs.existsSync(modelDir)) return;
        var info = getModelInfo(entry);
        result.push({
          id: String(idx), name: entry, group: entry.split('/')[0] || entry, message: message,
          is_multi: false, textures_count: info.textures_count, skins_count: info.skins_count,
          has_moc: info.has_moc, has_physics: info.has_physics, has_pose: info.has_pose,
          file_count: info.file_count, is_cubism4: info.is_cubism4, preview: info.preview,
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
    if (!isPathSafe(modelName)) return jsonRes(res, { success: false, data: null, message: 'Invalid model name' });
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

  if (endpoint === 'skins') {
    var params = new URL(req.url, 'http://localhost').searchParams;
    var modelName = params.get('model_name');
    if (!modelName) return jsonRes(res, { success: false, data: null, message: 'Missing model_name' });
    if (!isPathSafe(modelName)) return jsonRes(res, { success: false, data: null, message: 'Invalid model name' });
    var dir = path.join(MODEL_DIR, modelName);
    if (!fs.existsSync(dir)) return jsonRes(res, { success: false, data: null, message: 'Model not found' });

    var skins = [];
    var cachePath = path.join(dir, 'textures.cache');
    var orderPath = path.join(dir, 'textures_order.json');

    if (fs.existsSync(cachePath)) {
      try {
        var cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        if (Array.isArray(cache) && cache.length > 0) {
          if (Array.isArray(cache[0])) {
            for (var i = 0; i < cache.length; i++) {
              skins.push({ id: i + 1, textures: cache[i], name: 'Skin ' + (i + 1) });
            }
          } else if (typeof cache[0] === 'string') {
            for (var i = 0; i < cache.length; i++) {
              var tex = cache[i];
              var name = path.basename(tex, path.extname(tex));
              skins.push({ id: i + 1, textures: [tex], name: name });
            }
          }
        }
      } catch (e) {}
    } else if (fs.existsSync(orderPath)) {
      try {
        var order = JSON.parse(fs.readFileSync(orderPath, 'utf-8'));
        if (Array.isArray(order) && order.length > 0) {
          var combos = generateTextureCombinations(dir, order);
          for (var i = 0; i < combos.length; i++) {
            skins.push({ id: i + 1, textures: combos[i], name: 'Skin ' + (i + 1) });
          }
        }
      } catch (e) {}
    } else {
      // 自动扫描 textures 目录作为备选
      var texDir = path.join(dir, 'textures');
      if (fs.existsSync(texDir)) {
        try {
          var texFiles = fs.readdirSync(texDir).filter(function (f) {
            return /\.(png|jpg|jpeg|webp|avif)$/i.test(f);
          });
          for (var i = 0; i < texFiles.length; i++) {
            var tName = path.basename(texFiles[i], path.extname(texFiles[i]));
            skins.push({ id: i + 1, textures: ['textures/' + texFiles[i]], name: tName });
          }
        } catch (e) {}
      }
    }

    return jsonRes(res, { success: true, data: { model_name: modelName, skins_count: skins.length, skins: skins } });
  }

  // 设置模型封面图
  if (endpoint === 'set_cover') {
    if (req.method !== 'POST') return jsonRes(res, { success: false, data: null, message: 'Method not allowed' }, 405);
    var contentType = req.headers['content-type'] || '';
    if (contentType.indexOf('multipart/form-data') < 0) {
      return jsonRes(res, { success: false, data: null, message: 'Content-Type must be multipart/form-data' });
    }
    parseMultipart(req, function (err, parts) {
      if (err) return jsonRes(res, { success: false, data: null, message: err.message });
      var filePart = null;
      var modelName = '';
      parts.forEach(function (p) {
        if (p.name === 'file' && p.filename) filePart = p;
        if (p.name === 'model_name') modelName = (p.value || '').trim();
      });
      if (!modelName) return jsonRes(res, { success: false, data: null, message: 'Missing model_name' });
      if (!isPathSafe(modelName)) return jsonRes(res, { success: false, data: null, message: 'Invalid model name' });
      var dir = path.join(MODEL_DIR, modelName);
      if (!fs.existsSync(dir)) return jsonRes(res, { success: false, data: null, message: 'Model not found' });
      if (!filePart || !filePart.data) return jsonRes(res, { success: false, data: null, message: 'No file uploaded' });
      var ext = path.extname(filePart.filename).toLowerCase();
      if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.webp' && ext !== '.gif') return jsonRes(res, { success: false, data: null, message: 'Only image files allowed (png, jpg, webp, gif)' });
      if (filePart.data.length > 10 * 1024 * 1024) return jsonRes(res, { success: false, data: null, message: 'File too large (max 10MB)' });
      // 删除旧封面
      ['preview.png', 'preview.jpg', 'preview.jpeg', 'preview.webp', 'preview.gif'].forEach(function (f) {
        var old = path.join(dir, f);
        try { if (fs.existsSync(old)) fs.unlinkSync(old); } catch (e) { /* ignore permission errors on old files */ }
      });
      var previewFile = 'preview' + ext;
      var destPath = path.join(dir, previewFile);
      try {
        fs.writeFileSync(destPath, filePart.data);
      } catch (writeErr) {
        return jsonRes(res, { success: false, data: null, message: 'Failed to write preview' });
      }
      invalidateModelListCache();
      jsonRes(res, { success: true, data: { preview: 'model/' + modelName.replace(/\\/g, '/') + '/' + previewFile }, message: 'Cover updated' });
    });
    return;
  }

  if (endpoint === 'create') {
    readBody(req, function (body) {
      try {
        var input = JSON.parse(body);
        var name = (input.name || '').trim();
        var message = (input.message || '').trim();
        if (!name || !isPathSafe(name)) return jsonRes(res, { success: false, data: null, message: 'Invalid model name' });
        var dirPath = path.join(MODEL_DIR, name);
        if (!fs.existsSync(dirPath)) return jsonRes(res, { success: false, data: null, message: '模型目录不存在' });
        invalidateModelListCache();
        jsonRes(res, { success: true, data: { name: name, message: message }, message: 'Created' });
      } catch (e) { jsonRes(res, { success: false, data: null, message: '创建失败' }); }
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
        if (!isPathSafe(oldName)) return jsonRes(res, { success: false, data: null, message: 'Invalid old_name' });
        if (newName && !isPathSafe(newName)) return jsonRes(res, { success: false, data: null, message: 'Invalid new_name' });
        var oldDir = path.join(MODEL_DIR, oldName);
        if (!fs.existsSync(oldDir)) return jsonRes(res, { success: false, data: null, message: 'Model not found' });
        if (newName && newName !== oldName) {
          var newDir = path.join(MODEL_DIR, newName);
          if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
            fs.renameSync(oldDir, newDir);
          }
        }
        invalidateModelListCache();
        jsonRes(res, { success: true, data: null, message: 'Updated' });
      } catch (e) { jsonRes(res, { success: false, data: null, message: '更新失败' }); }
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
        if (!isPathSafe(name)) return jsonRes(res, { success: false, data: null, message: 'Invalid name' });
        var dir = path.join(MODEL_DIR, name);
        // 安全检查：确保删除路径在MODEL_DIR内
        var realDir = fs.existsSync(dir) ? fs.realpathSync(dir) : dir;
        var realModelDir = fs.realpathSync(MODEL_DIR);
        if (realDir !== realModelDir && realDir.indexOf(realModelDir + path.sep) !== 0) {
          return jsonRes(res, { success: false, data: null, message: 'Invalid path' });
        }
        if (!fs.existsSync(dir)) return jsonRes(res, { success: false, data: null, message: 'Model not found' });
        if (confirm) {
          function rmdirRecursive(p) {
            if (!fs.existsSync(p)) return;
            if (fs.statSync(p).isDirectory()) {
              fs.readdirSync(p).forEach(function (f) { rmdirRecursive(path.join(p, f)); });
              fs.rmdirSync(p);
            } else { fs.unlinkSync(p); }
          }
          rmdirRecursive(dir);
        }
        invalidateModelListCache();
        jsonRes(res, { success: true, data: null, message: 'Deleted' });
      } catch (e) { jsonRes(res, { success: false, data: null, message: '删除失败' }); }
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
    // 所有模型目录均已通过文件系统自动注册，无需过滤
    return jsonRes(res, { success: true, data: result });
  }

  if (endpoint === 'upload') {
    return handleUpload(req, res);
  }

  jsonRes(res, { success: false, data: null, message: 'Unknown endpoint' }, 404);
}

var server = http.createServer(function (req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

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

  // 动态返回模型列表（从文件系统扫描）
  if (urlPath === '/model_list.json') {
    try {
      var modelList = buildModelListFromFilesystem();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=5' });
      res.end(JSON.stringify(modelList));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end('{"models":[],"messages":[]}');
    }
    return;
  }

  // 公开 API: /get/, /rand/, /switch/, /rand_textures/, /switch_textures/, /add/, /skins/
  // 使用 req.url（含查询字符串）而非 urlPath（仅 pathname）
  if (urlPath.startsWith('/get/') || urlPath.startsWith('/rand/') || urlPath.startsWith('/switch/') ||
      urlPath.startsWith('/rand_textures/') || urlPath.startsWith('/switch_textures/') || urlPath.startsWith('/add/') ||
      urlPath.startsWith('/skins/')) {
    return handlePublicAPI(req, res, req.url);
  }

  // 前台 SPA 路由
  var FRONTEND_DIR = path.join(BASE, 'dist', 'frontend');
  if (urlPath === '/' || urlPath === '') {
    res.writeHead(302, { 'Location': '/frontend/' });
    res.end();
    return;
  }
  if (urlPath.startsWith('/frontend')) {
    var subPath = urlPath.slice('/frontend'.length) || '/';
    if (subPath === '/' || subPath === '') subPath = '/index.html';
    var frontFilePath = path.join(FRONTEND_DIR, subPath);
    if (fs.existsSync(frontFilePath) && !fs.statSync(frontFilePath).isDirectory()) {
      var fExt = path.extname(frontFilePath).toLowerCase();
      var fMime = MIME[fExt] || 'application/octet-stream';
      var fHeaders = { 'Content-Type': fMime };
      if (fExt === '.html') {
        fHeaders['Cache-Control'] = 'no-cache';
      } else {
        fHeaders['Cache-Control'] = 'public, max-age=86400';
      }
      res.writeHead(200, fHeaders);
      fs.createReadStream(frontFilePath).pipe(res);
      return;
    }
    // SPA fallback: 所有未匹配的前台路由返回 index.html
    var indexHtml = path.join(FRONTEND_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      fs.createReadStream(indexHtml).pipe(res);
      return;
    }
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

  if (urlPath === '/live2dcubismcore.min.js') {
    var corePath = path.join(BASE, 'admin', 'assets', 'js', 'live2dcubismcore.min.js');
    if (fs.existsSync(corePath)) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(corePath).pipe(res);
      return;
    }
  }

  if (urlPath === '/cubism4.min.js') {
    var c4Path = path.join(BASE, 'admin', 'assets', 'js', 'cubism4.min.js');
    if (fs.existsSync(c4Path)) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(c4Path).pipe(res);
      return;
    }
  }

  if (urlPath === '/pixi.min.js') {
    var pixiPath = path.join(BASE, 'admin', 'assets', 'js', 'pixi.min.js');
    if (fs.existsSync(pixiPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(pixiPath).pipe(res);
      return;
    }
  }

  var textureMatch = urlPath.match(/^\/model\/(.+)\/config-(\d+)\.json$/);
  if (textureMatch) {
    return handleTextureConfig(req, res, textureMatch[1], parseInt(textureMatch[2], 10));
  }

  var filePath;
  if (urlPath === '/admin' || urlPath === '/admin/') {
    filePath = path.join(BASE, 'admin', 'index.html');
  } else {
    filePath = path.join(BASE, urlPath);
  }

  // 防止路径遍历：确保解析后的路径在BASE目录内
  var resolvedPath = path.resolve(filePath);
  var resolvedBase = path.resolve(BASE);
  if (resolvedPath.indexOf(resolvedBase + path.sep) !== 0 && resolvedPath !== resolvedBase) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    var headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (urlPath.startsWith('/model/')) {
      headers['Access-Control-Allow-Origin'] = '*';
    }
    res.writeHead(404, headers);
    res.end('Not Found');
    return;
  }

  var ext = path.extname(filePath).toLowerCase();
  var mime = MIME[ext] || 'application/octet-stream';
  var headers = { 'Content-Type': mime };
  if (urlPath.startsWith('/model/')) {
    headers['Access-Control-Allow-Origin'] = '*';
    // 封面预览图使用 no-cache，避免重新生成后浏览器仍显示旧封面
    if (/\/preview\.(png|jpg|jpeg|webp|gif)$/i.test(urlPath)) {
      headers['Cache-Control'] = 'no-cache';
    } else {
      headers['Cache-Control'] = 'public, max-age=86400';
    }
  }

  var stat = fs.statSync(filePath);
  var etag = '"' + stat.size.toString(16) + '-' + stat.mtimeMs.toString(16) + '"';
  headers['ETag'] = etag;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304);
    res.end();
    return;
  }

  headers['Content-Length'] = stat.size;

  // 对文本类型启用 gzip 压缩
  var compressible = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.json';
  var acceptEncoding = req.headers['accept-encoding'] || '';
  if (compressible && acceptEncoding.indexOf('gzip') >= 0 && stat.size > 512) {
    headers['Content-Encoding'] = 'gzip';
    delete headers['Content-Length'];
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
  } else {
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  }
});

server.listen(8080, function () {
  console.log('Dev server running at http://localhost:8080/admin/');
});

// WebSocket 服务
try {
  var WebSocketServer = require('ws').Server;
  var wss = new WebSocketServer({ server: server, path: '/admin/ws' });

  wss.on('connection', function (ws, req) {
    // 通过 cookie 验证身份
    var user = getSession(req);
    if (!user) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws._user = user;
    wsClients.push(ws);

    ws.send(JSON.stringify({ type: 'connected' }));

    ws.on('close', function () {
      var idx = wsClients.indexOf(ws);
      if (idx >= 0) wsClients.splice(idx, 1);
    });

    ws.on('error', function () {
      var idx = wsClients.indexOf(ws);
      if (idx >= 0) wsClients.splice(idx, 1);
    });
  });

  console.log('WebSocket server ready at ws://localhost:8080/admin/ws');
} catch (e) {
  console.log('WebSocket module not available, using polling fallback');
}
