<?php
require '../tools/modelList.php';
require '../tools/modelTextures.php';
require '../tools/jsonCompatible.php';
require '../tools/validate.php';

$modelList = new modelList();
$modelTextures = new modelTextures();
$jsonCompatible = new jsonCompatible();

function find_model3_json($dir) {
    $items = scandir($dir);
    foreach ($items as $item) {
        if (preg_match('/\.model3\.json$/i', $item)) {
            return $dir . '/' . $item;
        }
    }
    return null;
}

function load_config($dir) {
    $indexPath = $dir . '/index.json';
    if (file_exists($indexPath)) {
        return array(json_decode(file_get_contents($indexPath), true), 'index.json');
    }
    $model3Path = find_model3_json($dir);
    if ($model3Path !== null) {
        $json = json_decode(file_get_contents($model3Path), true);
        if (isset($json['FileReferences'])) {
            $converted = array();
            $ref = $json['FileReferences'];
            if (isset($ref['Moc'])) $converted['model'] = $ref['Moc'];
            if (isset($ref['Textures'])) $converted['textures'] = $ref['Textures'];
            if (isset($ref['Physics'])) $converted['physics'] = $ref['Physics'];
            if (isset($ref['Pose'])) $converted['pose'] = $ref['Pose'];
            if (isset($ref['Motions']) && is_array($ref['Motions'])) {
                $motions = array();
                foreach ($ref['Motions'] as $groupName => $motionList) {
                    $motions[$groupName] = array();
                    foreach ($motionList as $m) {
                        $entry = array();
                        if (isset($m['File'])) $entry['file'] = $m['File'];
                        if (isset($m['Sound'])) $entry['sound'] = $m['Sound'];
                        $motions[$groupName][] = $entry;
                    }
                }
                $converted['motions'] = $motions;
            }
            if (isset($ref['Expressions']) && is_array($ref['Expressions'])) {
                $exprs = array();
                foreach ($ref['Expressions'] as $expr) {
                    $entry = array();
                    if (isset($expr['File'])) $entry['file'] = $expr['File'];
                    if (isset($expr['Name'])) $entry['name'] = $expr['Name'];
                    $exprs[] = $entry;
                }
                $converted['expressions'] = $exprs;
            }
            return array($converted, basename($model3Path));
        }
        return array($json, basename($model3Path));
    }
    return array(null, null);
}

if (isset($_GET['name'])) {
    $modelName = $_GET['name'];
    if (!validate_model_name($modelName)) exit('{"error":"invalid model name"}');
    $modelTexturesId = isset($_GET['textures_id']) ? (int)$_GET['textures_id'] : 0;

    $dir = '../model/' . $modelName;
    list($json, $configFile) = load_config($dir);
    if ($json === null) exit('{"error":"model config not found"}');

    if ($modelTexturesId > 0) {
        $modelTexturesName = $modelTextures->get_name($modelName, $modelTexturesId);
        if (isset($modelTexturesName)) $json['textures'] = is_array($modelTexturesName) ? $modelTexturesName : array($modelTexturesName);
    }
} elseif (isset($_GET['id'])) {
    $id = explode('-', $_GET['id']);
    if (count($id) > 2) exit('{"error":"invalid id format"}');
    $modelId = (int)$id[0];
    $modelTexturesId = isset($id[1]) ? (int)$id[1] : 0;

    $modelName = $modelList->id_to_name($modelId);

    if (is_array($modelName)) {
        $modelName = $modelTexturesId > 0 ? $modelName[$modelTexturesId-1] : $modelName[0];
        $dir = '../model/' . $modelName;
        list($json, $configFile) = load_config($dir);
        if ($json === null) exit('{"error":"model config not found"}');
    } else {
        $dir = '../model/' . $modelName;
        list($json, $configFile) = load_config($dir);
        if ($json === null) exit('{"error":"model config not found"}');
        if ($modelTexturesId > 0) {
            $modelTexturesName = $modelTextures->get_name($modelName, $modelTexturesId);
            if (isset($modelTexturesName)) $json['textures'] = is_array($modelTexturesName) ? $modelTexturesName : array($modelTexturesName);
        }
    }
} else {
    exit('error');
}

foreach ($json['textures'] as $k => $texture)
	$json['textures'][$k] = '../model/' . $modelName . '/' . $texture;

$json['model'] = '../model/'.$modelName.'/'.$json['model'];
if (isset($json['pose'])) $json['pose'] = '../model/'.$modelName.'/'.$json['pose'];
if (isset($json['physics'])) $json['physics'] = '../model/'.$modelName.'/'.$json['physics'];

if (isset($json['motions']))
    foreach ($json['motions'] as $k => $v) foreach($v as $k2 => $v2) foreach ($v2 as $k3 => $motion)
        if ($k3 == 'file' || $k3 == 'sound') $json['motions'][$k][$k2][$k3] = '../model/' . $modelName . '/' . $motion;

if (isset($json['expressions']))
    foreach ($json['expressions'] as $k => $v) foreach($v as $k2 => $expression)
        if ($k2 == 'file') $json['expressions'][$k][$k2] = '../model/' . $modelName . '/' . $expression;

header("Content-type: application/json; charset=utf-8");
echo $jsonCompatible->json_encode($json);
