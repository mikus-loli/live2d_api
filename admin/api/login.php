<?php
require __DIR__ . '/config.php';

header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(false, null, '仅支持 POST 请求');
}

$input = get_json_input();
if (!$input) {
    json_response(false, null, '请求数据无效');
}

$username = isset($input['username']) ? trim($input['username']) : '';
$password = isset($input['password']) ? $input['password'] : '';
$ip = get_client_ip();

if (empty($username) || empty($password)) {
    json_response(false, null, '请输入用户名和密码');
}

if (!check_rate_limit($ip, 'login')) {
    json_response(false, null, '登录尝试过于频繁，请稍后再试');
}

$user = find_user($username);
if (!$user) {
    sleep(1);
    json_response(false, null, '用户名或密码错误');
}

if (!empty($user['locked_until']) && time() < strtotime($user['locked_until'])) {
    $remaining = ceil((strtotime($user['locked_until']) - time()) / 60);
    json_response(false, null, '账户已被锁定，请 ' . $remaining . ' 分钟后重试');
}

if (!password_verify($password, $user['password_hash'])) {
    $data = load_users();
    $data['users'][$username]['failed_attempts'] = ($user['failed_attempts'] ?? 0) + 1;

    if ($data['users'][$username]['failed_attempts'] >= MAX_LOGIN_ATTEMPTS) {
        $data['users'][$username]['locked_until'] = date('c', time() + LOCKOUT_DURATION);
        save_users($data);
        json_response(false, null, '账户已被锁定 ' . (LOCKOUT_DURATION / 60) . ' 分钟，请稍后重试');
    }

    save_users($data);
    sleep(1);
    json_response(false, null, '用户名或密码错误');
}

$data = load_users();
$data['users'][$username]['failed_attempts'] = 0;
$data['users'][$username]['locked_until'] = null;
save_users($data);
clear_rate_limit($ip, 'login');

if (session_status() === PHP_SESSION_NONE) {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params(SESSION_LIFETIME, '/admin/', '', $secure, true);
    session_start();
}

session_regenerate_id(true);

$_SESSION['user'] = array(
    'username' => $username,
    'role' => $user['role'],
    'email' => $user['email'],
    'login_time' => time()
);

json_response(true, array(
    'username' => $username,
    'role' => $user['role']
), '登录成功');
