<?php

require __DIR__ . '/config.php';

function extract_zip($zipPath, $destDir) {
    $zip = new ZipArchive;
    $result = $zip->open($zipPath);
    if ($result !== true) {
        return false;
    }
    $zip->extractTo($destDir);
    $zip->close();
    return true;
}

function validate_extension($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $extWithDot = $ext;
    if (strpos($filename, '.exp3.json') !== false) {
        return true;
    }
    return in_array($ext, ALLOWED_EXTENSIONS);
}

function generate_index_json($modelDir, $modelName) {
    $files = scan_dir_recursive($modelDir);
    $textures = array();
    $mocFile = null;
    $physicsFile = null;

    foreach ($files as $file) {
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($ext === 'png' || $ext === 'jpg') {
            $textures[] = $file['name'];
        }
        if ($ext === 'moc' && $mocFile === null) {
            $mocFile = $file['name'];
        }
        if (basename($file['name']) === 'physics.json' && $physicsFile === null) {
            $physicsFile = $file['name'];
        }
    }

    $index = array(
        'version' => '1.0.0',
        'model' => $mocFile !== null ? $mocFile : 'model.moc',
        'textures' => $textures
    );

    if ($physicsFile !== null) {
        $index['physics'] = $physicsFile;
    }

    $index['layout'] = array(
        'center_x' => 0.0,
        'center_y' => -0.05,
        'width' => 2.0
    );

    file_put_contents($modelDir . '/index.json', json_encode($index, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return $index;
}

try {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $errMsg = 'No file uploaded';
        if (isset($_FILES['file'])) {
            switch ($_FILES['file']['error']) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $errMsg = 'File exceeds server upload size limit';
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $errMsg = 'No file was uploaded';
                    break;
            }
        }
        json_response(false, null, $errMsg);
    }

    $modelName = isset($_POST['model_name']) ? trim($_POST['model_name']) : '';
    if ($modelName === '') {
        json_response(false, null, 'model_name is required');
    }

    // 清理模型名称，移除不允许的字符
    $modelName = preg_replace('/[^a-zA-Z0-9_\-\/\u4e00-\u9fff]/', '', $modelName);
    if ($modelName === '') {
        json_response(false, null, 'Invalid model name');
    }

    $file = $_FILES['file'];
    if ($file['size'] > UPLOAD_MAX_SIZE) {
        json_response(false, null, 'File size exceeds maximum allowed size (50MB)');
    }

    $modelDir = MODEL_DIR . '/' . $modelName;

    if (!is_dir($modelDir)) {
        mkdir($modelDir, 0755, true);
    }

    $originalName = $file['name'];
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $uploadedFiles = array();

    if ($ext === 'zip') {
        $tmpDir = sys_get_temp_dir() . '/live2d_upload_' . time() . '_' . mt_rand();
        mkdir($tmpDir, 0755, true);

        if (!extract_zip($file['tmp_name'], $tmpDir)) {
            delete_dir_recursive($tmpDir);
            json_response(false, null, 'Failed to extract zip file');
        }

        $scanItems = scandir($tmpDir);
        $srcDir = $tmpDir;
        $singleDir = null;

        foreach ($scanItems as $item) {
            if ($item === '.' || $item === '..') continue;
            $itemPath = $tmpDir . '/' . $item;
            if (is_dir($itemPath) && $singleDir === null) {
                $singleDir = $itemPath;
            } elseif (is_file($itemPath)) {
                $singleDir = null;
                break;
            }
        }

        if ($singleDir !== null && count($scanItems) <= 3) {
            $srcDir = $singleDir;
        }

        $zipFiles = scan_dir_recursive($srcDir);
        foreach ($zipFiles as $zf) {
            if (!validate_extension($zf['name'])) continue;
            $srcPath = $srcDir . '/' . $zf['name'];
            $destPath = $modelDir . '/' . $zf['name'];
            $destSubDir = dirname($destPath);
            if (!is_dir($destSubDir)) {
                mkdir($destSubDir, 0755, true);
            }
            if (copy($srcPath, $destPath)) {
                $uploadedFiles[] = $zf['name'];
            }
        }

        delete_dir_recursive($tmpDir);
    } else {
        if (!validate_extension($originalName)) {
            json_response(false, null, 'File type not allowed: ' . $ext);
        }

        $destPath = $modelDir . '/' . basename($originalName);
        if (move_uploaded_file($file['tmp_name'], $destPath)) {
            $uploadedFiles[] = basename($originalName);
        } else {
            json_response(false, null, 'Failed to save uploaded file');
        }
    }

    $indexPath = $modelDir . '/index.json';
    $indexGenerated = false;
    if (!file_exists($indexPath) && !empty($uploadedFiles)) {
        generate_index_json($modelDir, $modelName);
        $indexGenerated = true;
    }

    $allFiles = scan_dir_recursive($modelDir);

    json_response(true, array(
        'model_name' => $modelName,
        'uploaded_files' => $uploadedFiles,
        'all_files' => $allFiles,
        'index_generated' => $indexGenerated
    ), 'File(s) uploaded successfully');
} catch (Exception $e) {
    json_response(false, null, $e->getMessage());
}
