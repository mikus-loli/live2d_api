<?php

require __DIR__ . '/config.php';

function has_model_files_in_dir($dir) {
    if (file_exists($dir . '/index.json')) return true;
    if (file_exists($dir . '/model.moc')) return true;

    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
        if ($ext === 'moc3' || $ext === 'moc') return true;
        if (preg_match('/\.model3\.json$/i', $item)) return true;
    }
    return false;
}

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
