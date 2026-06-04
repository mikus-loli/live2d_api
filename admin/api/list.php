<?php

require __DIR__ . '/config.php';

require_auth();

try {
    $modelList = get_model_list();
    $models = $modelList['models'];
    $messages = $modelList['messages'];
    $result = array();

    foreach ($models as $idx => $modelEntry) {
        $message = isset($messages[$idx]) ? $messages[$idx] : '';

        if (is_array($modelEntry)) {
            $group = '';
            $subModels = array();
            foreach ($modelEntry as $subIdx => $subName) {
                $parts = explode('/', $subName, 2);
                if ($group === '') $group = $parts[0];
                $subInfo = get_model_info($subName);
                $subInfo['id'] = $idx . '-' . $subIdx;
                $subInfo['name'] = $subName;
                $subInfo['message'] = $message;
                $subInfo['group'] = $group;
                $subModels[] = $subInfo;
            }
            $result[] = array(
                'id' => $idx,
                'name' => $group,
                'message' => $message,
                'group' => $group,
                'is_multi' => true,
                'sub_models' => $subModels
            );
        } else {
            $parts = explode('/', $modelEntry, 2);
            $group = isset($parts[0]) ? $parts[0] : '';
            $info = get_model_info($modelEntry);
            $info['id'] = (string)$idx;
            $info['name'] = $modelEntry;
            $info['message'] = $message;
            $info['group'] = $group;
            $info['is_multi'] = false;
            $result[] = $info;
        }
    }

    json_response(true, $result);
} catch (Exception $e) {
    json_response(false, null, $e->getMessage());
}

function get_model_info($modelName) {
    $dir = MODEL_DIR . '/' . $modelName;
    $info = array(
        'textures_count' => 0,
        'has_moc' => false,
        'has_physics' => false,
        'has_pose' => false,
        'file_count' => 0
    );

    if (!is_dir($dir)) return $info;

    $files = scan_dir_recursive($dir);
    $info['file_count'] = count($files);

    foreach ($files as $file) {
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $basename = basename($file['name']);
        if ($ext === 'moc' || $ext === 'moc3') $info['has_moc'] = true;
        if (preg_match('/\.physics(3)?\.json$/i', $basename)) $info['has_physics'] = true;
        if ($basename === 'pose.json') $info['has_pose'] = true;
        if (preg_match('/\.(png|jpg|avif)$/i', $basename)) $info['textures_count']++;
    }

    $indexPath = $dir . '/index.json';
    $model3Path = find_model3_json($dir);
    $configPath = file_exists($indexPath) ? $indexPath : $model3Path;
    if ($configPath !== null && file_exists($configPath)) {
        $config = json_decode(file_get_contents($configPath), true);
        if ($config !== null) {
            $textures = extract_textures_from_config($config);
            if (count($textures) > 0) {
                $info['textures_count'] = count($textures);
            }
        }
    }

    $cachePath = $dir . '/textures.cache';
    if (file_exists($cachePath)) {
        $cache = json_decode(file_get_contents($cachePath), true);
        if (is_array($cache) && count($cache) > 0) {
            if (is_string($cache[0])) {
                $info['textures_count'] = count($cache);
            } elseif (is_array($cache[0])) {
                $info['textures_count'] = count($cache[0]);
            }
        }
    }

    return $info;
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

function extract_textures_from_config($config) {
    $textures = array();
    if (isset($config['FileReferences']['Textures']) && is_array($config['FileReferences']['Textures'])) {
        $textures = $config['FileReferences']['Textures'];
    } elseif (isset($config['textures']) && is_array($config['textures'])) {
        $textures = $config['textures'];
    }
    return $textures;
}
