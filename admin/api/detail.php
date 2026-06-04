<?php

require __DIR__ . '/config.php';

require_auth();

try {
    $modelName = isset($_GET['model_name']) ? $_GET['model_name'] : '';
    if ($modelName === '') {
        json_response(false, null, 'model_name parameter is required');
    }

    if (!validate_model_name($modelName)) {
        json_response(false, null, 'Invalid model name');
    }

    $dir = MODEL_DIR . '/' . $modelName;
    if (!is_dir($dir)) {
        json_response(false, null, 'Model directory not found');
    }

    $configPath = $dir . '/index.json';
    if (!file_exists($configPath)) {
        $configPath = find_model3_json($dir);
    }
    $config = null;
    if ($configPath !== null && file_exists($configPath)) {
        $config = json_decode(file_get_contents($configPath), true);
    }

    $files = scan_dir_recursive($dir);

    $textures = array();
    $motions = array();
    if ($config !== null) {
        $textures = extract_textures_from_config($config);
        $motions = extract_motions_from_config($config);
    }

    $data = array(
        'name' => $modelName,
        'config' => $config,
        'files' => $files,
        'textures' => $textures,
        'motions' => $motions
    );

    json_response(true, $data);
} catch (Exception $e) {
    json_response(false, null, $e->getMessage());
}
