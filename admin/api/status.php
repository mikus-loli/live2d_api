<?php
require __DIR__ . '/config.php';

header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(false, null, '仅支持 GET 请求');
}

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(SESSION_LIFETIME, '/admin/', '', false, true);
    session_start();
}

if (empty($_SESSION['user']) || empty($_SESSION['user']['username'])) {
    json_response(false, null, '未登录');
}

$user = $_SESSION['user'];

if ($user['login_time'] && (time() - $user['login_time']) > SESSION_LIFETIME) {
    $_SESSION = array();
    session_destroy();
    json_response(false, null, '会话已过期');
}

$_SESSION['user']['login_time'] = time();

json_response(true, array(
    'username' => $user['username'],
    'role' => $user['role'],
    'email' => $user['email']
));
