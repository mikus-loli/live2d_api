<?php

require __DIR__ . '/config.php';

try {
    $input = get_json_input();
    if (!$input) {
        json_response(false, null, 'Invalid JSON input');
    }

    $oldName = isset($input['old_name']) ? trim($input['old_name']) : '';
    $newName = isset($input['new_name']) ? trim($input['new_name']) : '';
    $newName = preg_replace('/[^a-zA-Z0-9_\-\/\x{4e00}-\x{9fff}]/u', '', $newName);
    $message = isset($input['message']) ? $input['message'] : null;

    if ($oldName === '') {
        json_response(false, null, 'old_name is required');
    }

    $list = get_model_list();
    $found = false;
    $foundIdx = -1;
    $foundSubIdx = -1;

    foreach ($list['models'] as $idx => $entry) {
        if (is_array($entry)) {
            $subIdx = array_search($oldName, $entry);
            if ($subIdx !== false) {
                $found = true;
                $foundIdx = $idx;
                $foundSubIdx = $subIdx;
                break;
            }
        } else {
            if ($entry === $oldName) {
                $found = true;
                $foundIdx = $idx;
                break;
            }
        }
    }

    if (!$found) {
        json_response(false, null, 'Model not found in model_list.json: ' . $oldName);
    }

    if ($newName !== '' && $newName !== $oldName) {
        $oldDir = MODEL_DIR . '/' . $oldName;
        $newDir = MODEL_DIR . '/' . $newName;

        if (is_dir($oldDir) && !is_dir($newDir)) {
            $hasSlash = strpos($newName, '/') !== false;
            if ($hasSlash) {
                $newParts = explode('/', $newName, 2);
                $newGroupDir = MODEL_DIR . '/' . $newParts[0];
                if (!is_dir($newGroupDir)) {
                    mkdir($newGroupDir, 0755, true);
                }
            }
            if (!rename($oldDir, $newDir)) {
                json_response(false, null, 'Failed to rename model directory');
            }
        }

        if ($foundSubIdx >= 0) {
            $list['models'][$foundIdx][$foundSubIdx] = $newName;
        } else {
            $list['models'][$foundIdx] = $newName;
        }
    }

    if ($message !== null) {
        $list['messages'][$foundIdx] = $message;
    }

    save_model_list($list);

    $resultName = $newName !== '' && $newName !== $oldName ? $newName : $oldName;
    json_response(true, array('name' => $resultName), 'Model updated successfully');
} catch (Exception $e) {
    json_response(false, null, '更新失败');
}
