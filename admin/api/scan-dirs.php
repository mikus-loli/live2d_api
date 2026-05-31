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

function find_model3_json($dir) {
    $items = scandir($dir);
    foreach ($items as $item) {
        if (preg_match('/\.model3\.json$/i', $item)) {
            return $dir . '/' . $item;
        }
    }
    return null;
}

try {
    $dirs = array();
    if (is_dir(MODEL_DIR)) {
        $groups = scandir(MODEL_DIR);
        foreach ($groups as $group) {
            if ($group === '.' || $group === '..') continue;
            $groupPath = MODEL_DIR . '/' . $group;
            if (!is_dir($groupPath)) continue;

            if (has_model_files_in_dir($groupPath)) {
                $dirs[] = array(
                    'name' => $group,
                    'has_index' => file_exists($groupPath . '/index.json'),
                    'has_model3' => find_model3_json($groupPath) !== null,
                    'has_moc' => file_exists($groupPath . '/model.moc'),
                    'has_moc3' => find_model3_json($groupPath) !== null
                );
            }

            $models = scandir($groupPath);
            foreach ($models as $model) {
                if ($model === '.' || $model === '..') continue;
                $modelPath = $groupPath . '/' . $model;
                if (!is_dir($modelPath)) continue;
                if (has_model_files_in_dir($modelPath)) {
                    $rel = $group . '/' . $model;
                    $m3 = find_model3_json($modelPath);
                    $dirs[] = array(
                        'name' => $rel,
                        'has_index' => file_exists($modelPath . '/index.json'),
                        'has_model3' => $m3 !== null,
                        'has_moc' => file_exists($modelPath . '/model.moc'),
                        'has_moc3' => $m3 !== null
                    );
                }
            }
        }
    }

    json_response(true, $dirs);
} catch (Exception $e) {
    json_response(false, null, $e->getMessage());
}
