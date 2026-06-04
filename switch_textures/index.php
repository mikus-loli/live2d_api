<?php
if (!isset($_GET['id'])) {
    header("Content-type: application/json");
    echo json_encode(array('error' => 'id parameter is required'));
    exit;
}

$id = $_GET['id'];

require '../tools/modelList.php';
require '../tools/modelTextures.php';
require '../tools/jsonCompatible.php';

$modelListObj = new modelList();
$modelTextures = new modelTextures();
$jsonCompatible = new jsonCompatible();

$id = explode('-', $id);
$modelId = (int)$id[0];
$modelTexturesId = isset($id[1]) ? (int)$id[1] : 0;

$modelName = $modelListObj->id_to_name($modelId);
if ($modelName === null) {
    header("Content-type: application/json");
    echo json_encode(array('error' => 'invalid model id'));
    exit;
}
$modelTexturesList = is_array($modelName) ? array('textures' => $modelName) : $modelTextures->get_list($modelName);
$modelTexturesNewId = $modelTexturesId === 0 ? 2 : $modelTexturesId + 1;
if (!isset($modelTexturesList['textures'][$modelTexturesNewId-1])) $modelTexturesNewId = 1;

header("Content-type: application/json");
echo $jsonCompatible->json_encode(array('textures' => array(
    'id' => $modelTexturesNewId,
    'name' => $modelTexturesList['textures'][$modelTexturesNewId-1],
    'model' => is_array($modelName) ? $modelName[$modelTexturesNewId-1] : $modelName
)));
