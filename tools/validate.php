<?php
function validate_model_name($name) {
    if (empty($name)) return false;
    if (strpos($name, '..') !== false) return false;
    if ($name[0] === '/') return false;
    return preg_match('/^[a-zA-Z0-9_\-\/\x{4e00}-\x{9fff}]+$/u', $name) === 1;
}
