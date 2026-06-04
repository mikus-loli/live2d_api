<?php

define('MODEL_DIR', __DIR__ . '/../../model');
define('UPLOAD_MAX_SIZE', 50 * 1024 * 1024);
define('ALLOWED_EXTENSIONS', array('moc', 'moc3', 'json', 'mtn', 'png', 'jpg', 'avif'));

define('USERS_FILE', __DIR__ . '/users.json');
define('RATE_LIMIT_FILE', __DIR__ . '/rate_limit.json');
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOCKOUT_DURATION', 900);
define('SESSION_LIFETIME', 86400);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function json_response($success, $data = null, $message = '') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array(
        'success' => $success,
        'data' => $data,
        'message' => $message
    ), JSON_UNESCAPED_UNICODE);
    exit;
}

function count_model_skins($modelPath) {
    $texDir = $modelPath . '/textures';
    if (is_dir($texDir)) {
        $files = @scandir($texDir);
        if ($files !== false) {
            $count = 0;
            foreach ($files as $f) {
                if (preg_match('/\.(png|jpg|jpeg|webp|avif)$/i', $f)) {
                    $count++;
                }
            }
            return $count ?: 1;
        }
    }
    return 1;
}

function find_preview($modelDir) {
    $exts = array('.png', '.jpg', '.jpeg', '.webp', '.gif');
    foreach ($exts as $ext) {
        if (file_exists($modelDir . '/preview' . $ext)) {
            return 'preview' . $ext;
        }
    }
    return null;
}

function get_model_list() {
    // 从文件系统扫描模型目录，自动构建模型列表
    $models = array();
    $messages = array();
    $skinCounts = array();
    $previews = array();
    if (!is_dir(MODEL_DIR)) return array('models' => $models, 'messages' => $messages, 'skin_counts' => $skinCounts, 'previews' => $previews);

    $entries = scandir(MODEL_DIR);
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..' || strpos($entry, '.') === 0 || $entry === '.gitkeep') continue;
        $entryPath = MODEL_DIR . '/' . $entry;
        if (!is_dir($entryPath)) continue;

        // 检查此目录自身是否为模型（包含 index.json 或 .model3.json）
        $subFiles = @scandir($entryPath);
        if ($subFiles === false) continue;
        $hasConfig = false;
        foreach ($subFiles as $sf) {
            if ($sf === 'index.json' || preg_match('/\.model3\.json$/i', $sf)) {
                $hasConfig = true;
                break;
            }
        }

        if ($hasConfig) {
            $models[] = $entry;
            $messages[] = $entry;
            $skinCounts[] = count_model_skins(MODEL_DIR . '/' . $entry);
            $pvFile = find_preview(MODEL_DIR . '/' . $entry);
            $previews[] = $pvFile ? ('model/' . str_replace('\\', '/', $entry) . '/' . $pvFile) : null;
        } else {
            // 分组目录：扫描子模型
            $subDirs = array();
            foreach ($subFiles as $subEntry) {
                if ($subEntry === '.' || $subEntry === '..' || strpos($subEntry, '.') === 0 || $subEntry === 'general') continue;
                $subPath = $entryPath . '/' . $subEntry;
                if (!is_dir($subPath)) continue;
                $modelFiles = @scandir($subPath);
                if ($modelFiles === false) continue;
                foreach ($modelFiles as $mf) {
                    if ($mf === 'index.json' || preg_match('/\.model3\.json$/i', $mf)) {
                        $subDirs[] = $entry . '/' . $subEntry;
                        break;
                    }
                }
            }
            if (count($subDirs) === 1) {
                $models[] = $subDirs[0];
                $messages[] = $entry;
                $skinCounts[] = count_model_skins(MODEL_DIR . '/' . $subDirs[0]);
                $pvFile = find_preview(MODEL_DIR . '/' . $subDirs[0]);
                $previews[] = $pvFile ? ('model/' . str_replace('\\', '/', $subDirs[0]) . '/' . $pvFile) : null;
            } elseif (count($subDirs) > 1) {
                $models[] = $subDirs;
                $messages[] = $entry;
                $groupSkins = array();
                $groupPreviews = array();
                foreach ($subDirs as $subDir) {
                    $groupSkins[] = count_model_skins(MODEL_DIR . '/' . $subDir);
                    $pvFile2 = find_preview(MODEL_DIR . '/' . $subDir);
                    $groupPreviews[] = $pvFile2 ? ('model/' . str_replace('\\', '/', $subDir) . '/' . $pvFile2) : null;
                }
                $skinCounts[] = $groupSkins;
                $previews[] = $groupPreviews;
            }
        }
    }

    return array('models' => $models, 'messages' => $messages, 'skin_counts' => $skinCounts, 'previews' => $previews);
}

function save_model_list($list) {
    // 模型列表基于文件系统自动生成，无需保存
}

function scan_dir_recursive($dir, $base = '') {
    $result = array();
    if (!is_dir($dir)) return $result;
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . '/' . $item;
        $relative = $base === '' ? $item : $base . '/' . $item;
        if (is_dir($path)) {
            $result = array_merge($result, scan_dir_recursive($path, $relative));
        } else {
            $result[] = array(
                'name' => $relative,
                'size' => filesize($path)
            );
        }
    }
    return $result;
}

function get_json_input() {
    $input = file_get_contents('php://input');
    return json_decode($input, true);
}

function delete_dir_recursive($dir) {
    if (!is_dir($dir)) return false;
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . '/' . $item;
        is_dir($path) ? delete_dir_recursive($path) : unlink($path);
    }
    return rmdir($dir);
}

function load_users() {
    if (!file_exists(USERS_FILE)) {
        return array('users' => array(), 'reset_tokens' => array());
    }
    $content = file_get_contents(USERS_FILE);
    $data = json_decode($content, true);
    if (!isset($data['users'])) $data['users'] = array();
    if (!isset($data['reset_tokens'])) $data['reset_tokens'] = array();
    return $data;
}

function save_users($data) {
    $dir = dirname(USERS_FILE);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents(USERS_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function find_user($username) {
    $data = load_users();
    if (isset($data['users'][$username])) {
        return $data['users'][$username];
    }
    return null;
}

function check_rate_limit($ip, $action) {
    $data = array();
    if (file_exists(RATE_LIMIT_FILE)) {
        $content = file_get_contents(RATE_LIMIT_FILE);
        $data = json_decode($content, true);
        if (!$data) $data = array();
    }

    $now = time();
    if (!isset($data[$action])) $data[$action] = array();
    if (!isset($data[$action][$ip])) $data[$action][$ip] = array('attempts' => 0, 'first_attempt' => 0);

    $entry = &$data[$action][$ip];

    if ($now - $entry['first_attempt'] > 60) {
        $entry['attempts'] = 1;
        $entry['first_attempt'] = $now;
    } else {
        $entry['attempts']++;
    }

    file_put_contents(RATE_LIMIT_FILE, json_encode($data, JSON_UNESCAPED_UNICODE));
    return $entry['attempts'] <= MAX_LOGIN_ATTEMPTS;
}

function clear_rate_limit($ip, $action) {
    if (!file_exists(RATE_LIMIT_FILE)) return;
    $content = file_get_contents(RATE_LIMIT_FILE);
    $data = json_decode($content, true);
    if (!$data) return;

    if (isset($data[$action][$ip])) {
        unset($data[$action][$ip]);
        file_put_contents(RATE_LIMIT_FILE, json_encode($data, JSON_UNESCAPED_UNICODE));
    }
}

function require_auth() {
    if (session_status() === PHP_SESSION_NONE) {
        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        session_set_cookie_params(SESSION_LIFETIME, '/admin/', '', $secure, true);
        session_start();
    }

    if (empty($_SESSION['user']) || empty($_SESSION['user']['username'])) {
        http_response_code(401);
        json_response(false, null, '未登录或会话已过期');
    }
    return $_SESSION['user'];
}

function get_client_ip() {
    // 仅在受信任代理后使用 X-Forwarded-For，取最后一个
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[count($ips) - 1]);
    }
    return $_SERVER['REMOTE_ADDR'];
}

function generate_reset_token() {
    return bin2hex(openssl_random_pseudo_bytes(32));
}

function validate_password_strength($password) {
    if (strlen($password) < 8) return '密码长度至少为 8 个字符';
    if (!preg_match('/[A-Z]/', $password) && !preg_match('/[a-z]/', $password)) return '密码必须包含至少一个字母';
    if (!preg_match('/[0-9]/', $password)) return '密码必须包含至少一个数字';
    return null;
}
