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

$token = isset($input['token']) ? trim($input['token']) : '';
$new_password = isset($input['new_password']) ? $input['new_password'] : '';
$ip = get_client_ip();

if (empty($token) || empty($new_password)) {
    json_response(false, null, '缺少必要参数');
}

$error = validate_password_strength($new_password);
if ($error) {
    json_response(false, null, $error);
}

if (!check_rate_limit($ip, 'reset_confirm')) {
    json_response(false, null, '请求过于频繁，请稍后再试');
}

$data = load_users();
if (!isset($data['reset_tokens'][$token])) {
    json_response(false, null, '重置令牌无效');
}

$token_data = $data['reset_tokens'][$token];

if (time() > $token_data['expires_at']) {
    unset($data['reset_tokens'][$token]);
    save_users($data);
    json_response(false, null, '重置令牌已过期');
}

$username = $token_data['username'];
if (!isset($data['users'][$username])) {
    json_response(false, null, '用户不存在');
}

$data['users'][$username]['password_hash'] = password_hash($new_password, PASSWORD_BCRYPT, array('cost' => 12));
$data['users'][$username]['failed_attempts'] = 0;
$data['users'][$username]['locked_until'] = null;
unset($data['reset_tokens'][$token]);
save_users($data);

clear_rate_limit($ip, 'reset_confirm');

json_response(true, null, '密码重置成功，请使用新密码登录');
