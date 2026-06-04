<?php class modelList {

    /* 获取模型列表 */
    function get_list() {
        $content = @file_get_contents('../model_list.json');
        if ($content === false) return array('models' => array(), 'messages' => array());
        $data = json_decode($content, true);
        if (!is_array($data)) return array('models' => array(), 'messages' => array());
        return $data;
    }

    /* 获取模组名称 */
    function id_to_name($id) {
        $list = self::get_list();
        $idx = (int)$id - 1;
        if ($idx < 0 || !isset($list['models'][$idx])) return null;
        return $list['models'][$idx];
    }

    /* 转换模型名称 */
    function name_to_id($name) {
        $list = self::get_list();
        $id = array_search($name, $list['models']);
        return is_numeric($id) ? $id + 1 : false;
    }

}
