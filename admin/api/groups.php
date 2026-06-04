<?php

require __DIR__ . '/config.php';

require_auth();

try {
    if (!is_dir(MODEL_DIR)) {
        json_response(false, null, 'Model directory not found');
    }

    $groups = array();
    $items = scandir(MODEL_DIR);

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = MODEL_DIR . '/' . $item;
        if (!is_dir($path)) continue;

        $modelCount = 0;

        if (has_model_files_in_dir($path)) {
            $modelCount++;
        }

        $subItems = scandir($path);
        foreach ($subItems as $subItem) {
            if ($subItem === '.' || $subItem === '..') continue;
            $subPath = $path . '/' . $subItem;
            if (!is_dir($subPath)) continue;
            if (has_model_files_in_dir($subPath)) {
                $modelCount++;
            }
        }

        $groups[] = array(
            'name' => $item,
            'model_count' => $modelCount
        );
    }

    json_response(true, $groups);
} catch (Exception $e) {
    json_response(false, null, $e->getMessage());
}
