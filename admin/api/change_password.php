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

$current_password = isset($input['current_password']) ? $input['current_password'] : '';
$new_password = isset($input['new_password']) ? $input['new_password'] : '';

if (empty($current_password) || empty($new_password)) {
    json_response(false, null, '请输入当前密码和新密码');
}

$error = validate_password_strength($new_password);
if ($error) {
    json_response(false, null, $error);
}

$user = require_auth();

$user_data = find_user($user['username']);
if (!$user_data) {
    json_response(false, null, '用户不存在');
}

if (!password_verify($current_password, $user_data['password_hash'])) {
    json_response(false, null, '当前密码错误');
}

$data = load_users();
$data['users'][$user['username']]['password_hash'] = password_hash($new_password, PASSWORD_BCRYPT, array('cost' => 12));
save_users($data);

json_response(true, null, '密码修改成功，请重新登录');
