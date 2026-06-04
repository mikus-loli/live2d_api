<?php

require __DIR__ . '/config.php';

require_auth();

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(false, null, 'Method not allowed');
    }

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

    $modelName = preg_replace('/[^a-zA-Z0-9_\-\/\x{4e00}-\x{9fff}]/u', '', $modelName);
    if ($modelName === '' || !validate_model_name($modelName)) {
        json_response(false, null, 'Invalid model name');
    }

    $dir = MODEL_DIR . '/' . $modelName;
    if (!is_dir($dir)) {
        json_response(false, null, 'Model not found');
    }

    $file = $_FILES['file'];
    if ($file['size'] > 10 * 1024 * 1024) {
        json_response(false, null, 'File too large (max 10MB)');
    }

    $originalName = $file['name'];
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($ext, array('png', 'jpg', 'jpeg', 'webp', 'gif'))) {
        json_response(false, null, 'Only image files allowed (png, jpg, webp, gif)');
    }

    // 删除旧封面
    $prevExts = array('png', 'jpg', 'jpeg', 'webp', 'gif');
    foreach ($prevExts as $prevExt) {
        $oldPath = $dir . '/preview.' . $prevExt;
        if (file_exists($oldPath)) {
            unlink($oldPath);
        }
    }

    // 写入新封面
    $previewFile = 'preview.' . $ext;
    $destPath = $dir . '/' . $previewFile;
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        json_response(false, null, 'Failed to save cover image');
    }

    json_response(true, array(
        'preview' => 'model/' . str_replace('\\', '/', $modelName) . '/' . $previewFile
    ), 'Cover updated');
} catch (Exception $e) {
    json_response(false, null, $e->getMessage());
}
