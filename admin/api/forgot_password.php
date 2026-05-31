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

$username_or_email = isset($input['username_or_email']) ? trim($input['username_or_email']) : '';
$ip = get_client_ip();

if (empty($username_or_email)) {
    json_response(false, null, '请输入用户名或邮箱');
}

if (!check_rate_limit($ip, 'reset_request')) {
    json_response(false, null, '请求过于频繁，请稍后再试');
}

$data = load_users();
$found_username = null;
$found_email = null;

foreach ($data['users'] as $uname => $user) {
    if (strtolower($uname) === strtolower($username_or_email) ||
        strtolower($user['email']) === strtolower($username_or_email)) {
        $found_username = $uname;
        $found_email = $user['email'];
        break;
    }
}

sleep(1);

if (!$found_username) {
    $dummy_token = generate_reset_token();
    json_response(true, array(
        'reset_token' => $dummy_token,
        'expires_in' => 3600
    ), '如果账户存在，重置令牌已生成');
}

$token = generate_reset_token();
$data['reset_tokens'][$token] = array(
    'username' => $found_username,
    'created_at' => time(),
    'expires_at' => time() + 3600
);
save_users($data);

json_response(true, array(
    'reset_token' => $token,
    'expires_in' => 3600
), '重置令牌已生成');
