<?php
if (!isset($_GET['id'])) {
    header("Content-type: application/json");
    echo json_encode(array('error' => 'id parameter is required'));
    exit;
}

$modelId = (int)$_GET['id'];

require '../tools/modelList.php';
require '../tools/jsonCompatible.php';

$modelListObj = new modelList();
$jsonCompatible = new jsonCompatible();

$modelList = $modelListObj->get_list();

$totalModels = count($modelList['models']);
if ($totalModels === 0) {
    header("Content-type: application/json");
    echo json_encode(array('error' => 'no models available'));
    exit;
}

if ($totalModels === 1) {
    $modelRandId = 1;
} else {
    $modelRandNewId = true;
    while ($modelRandNewId) {
        $modelRandId = rand(0, $totalModels - 1) + 1;
        $modelRandNewId = ($modelRandId === $modelId);
    }
}

header("Content-type: application/json");
echo $jsonCompatible->json_encode(array('model' => array(
    'id' => $modelRandId,
    'name' => $modelList['models'][$modelRandId-1],
    'message' => $modelList['messages'][$modelRandId-1]
)));
