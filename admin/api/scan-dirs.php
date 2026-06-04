<?php

require __DIR__ . '/config.php';

require_auth();

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
