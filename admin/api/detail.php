<?php

require __DIR__ . '/config.php';

function find_model3_json($dir) {
    $items = scandir($dir);
    foreach ($items as $item) {
        if (preg_match('/\.model3\.json$/i', $item)) {
            return $dir . '/' . $item;
        }
    }
    return null;
}

function extract_textures_from_config($config) {
    if (isset($config['FileReferences']['Textures']) && is_array($config['FileReferences']['Textures'])) {
        return $config['FileReferences']['Textures'];
    }
    if (isset($config['textures']) && is_array($config['textures'])) {
        return $config['textures'];
    }
    return array();
}

function extract_motions_from_config($config) {
    $motions = array();
    if (isset($config['motions']) && is_array($config['motions'])) {
        foreach ($config['motions'] as $group => $motionList) {
            $motions[$group] = array();
            foreach ($motionList as $motion) {
                $entry = array();
                if (isset($motion['file'])) $entry['file'] = $motion['file'];
                if (isset($motion['sound'])) $entry['sound'] = $motion['sound'];
                if (isset($motion['fade_in'])) $entry['fade_in'] = $motion['fade_in'];
                if (isset($motion['fade_out'])) $entry['fade_out'] = $motion['fade_out'];
                $motions[$group][] = $entry;
            }
        }
    }
    if (isset($config['Groups']) && is_array($config['Groups'])) {
        foreach ($config['Groups'] as $group) {
            $groupName = isset($group['Name']) ? $group['Name'] : 'Group';
            if (!isset($motions[$groupName])) $motions[$groupName] = array();
        }
    }
    return $motions;
}

try {
    $modelName = isset($_GET['model_name']) ? $_GET['model_name'] : '';
    if ($modelName === '') {
        json_response(false, null, 'model_name parameter is required');
    }

    $dir = MODEL_DIR . '/' . $modelName;
    if (!is_dir($dir)) {
        json_response(false, null, 'Model directory not found: ' . $modelName);
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
