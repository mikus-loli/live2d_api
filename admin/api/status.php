<?php
require __DIR__ . '/config.php';

header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(false, null, '仅支持 GET 请求');
}

$user = require_auth();

json_response(true, array(
    'username' => $user['username'],
    'role' => $user['role'],
    'email' => $user['email']
));
