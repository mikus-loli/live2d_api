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
$modelSwitchId = $modelId + 1;
if (!isset($modelList['models'][$modelSwitchId-1])) $modelSwitchId = 1;

header("Content-type: application/json");
echo $jsonCompatible->json_encode(array('model' => array(
    'id' => $modelSwitchId,
    'name' => $modelList['models'][$modelSwitchId-1],
    'message' => $modelList['messages'][$modelSwitchId-1]
)));
