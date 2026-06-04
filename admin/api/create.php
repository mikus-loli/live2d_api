<?php

require __DIR__ . '/config.php';

require_auth();

try {
    $input = get_json_input();
    if (!$input) {
        json_response(false, null, 'Invalid JSON input');
    }

    $name = isset($input['name']) ? trim($input['name']) : '';
    $message = isset($input['message']) ? trim($input['message']) : '';

    if ($name === '') {
        json_response(false, null, 'name is required');
    }

    // 清理模型名称
    $name = preg_replace('/[^a-zA-Z0-9_\-\/\x{4e00}-\x{9fff}]/u', '', $name);
    if ($name === '' || !validate_model_name($name)) {
        json_response(false, null, 'Invalid name format');
    }

    $modelDir = MODEL_DIR . '/' . $name;
    if (!is_dir($modelDir)) {
        json_response(false, null, 'Model directory does not exist: ' . $name);
    }

    $list = get_model_list();

    foreach ($list['models'] as $entry) {
        if (is_array($entry)) {
            if (in_array($name, $entry)) {
                json_response(false, null, 'Model already exists');
            }
        } else {
            if ($entry === $name) {
                json_response(false, null, 'Model already exists');
            }
        }
    }

    $list['models'][] = $name;
    $list['messages'][] = $message;

    save_model_list($list);

    json_response(true, array('name' => $name, 'message' => $message), 'Model added successfully');
} catch (Exception $e) {
    json_response(false, null, '创建失败');
}
