<?php

require __DIR__ . '/config.php';

require_auth();

try {
    $input = get_json_input();
    if (!$input) {
        json_response(false, null, 'Invalid JSON input');
    }

    $name = isset($input['name']) ? trim($input['name']) : '';
    $confirm = isset($input['confirm']) ? (bool)$input['confirm'] : false;

    if ($name === '') {
        json_response(false, null, 'name is required');
    }

    if (!validate_model_name($name)) {
        json_response(false, null, 'Invalid name format');
    }

    $list = get_model_list();
    $found = false;
    $foundIdx = -1;
    $foundSubIdx = -1;

    foreach ($list['models'] as $idx => $entry) {
        if (is_array($entry)) {
            $subIdx = array_search($name, $entry);
            if ($subIdx !== false) {
                $found = true;
                $foundIdx = $idx;
                $foundSubIdx = $subIdx;
                break;
            }
        } else {
            if ($entry === $name) {
                $found = true;
                $foundIdx = $idx;
                break;
            }
        }
    }

    if (!$found) {
        json_response(false, null, 'Model not found: ' . $name);
    }

    if ($foundSubIdx >= 0) {
        array_splice($list['models'][$foundIdx], $foundSubIdx, 1);
        if (empty($list['models'][$foundIdx])) {
            array_splice($list['models'], $foundIdx, 1);
            array_splice($list['messages'], $foundIdx, 1);
        }
    } else {
        array_splice($list['models'], $foundIdx, 1);
        array_splice($list['messages'], $foundIdx, 1);
    }

    save_model_list($list);

    $deletedFiles = false;
    if ($confirm) {
        $modelDir = MODEL_DIR . '/' . $name;
        if (is_dir($modelDir)) {
            $deletedFiles = delete_dir_recursive($modelDir);
        }
    }

    $result = array(
        'name' => $name,
        'files_deleted' => $deletedFiles
    );

    json_response(true, $result, 'Model removed from list' . ($deletedFiles ? ' and files deleted' : ''));
} catch (Exception $e) {
    json_response(false, null, '删除失败');
}
