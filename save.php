<?php
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(array("ok" => false, "message" => "Use POST to save database.json"));
  exit;
}

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);
if (!is_array($data) || !isset($data["projects"]) || !is_array($data["projects"])) {
  http_response_code(400);
  echo json_encode(array("ok" => false, "message" => "The data sent was not a dashboard database"));
  exit;
}

$path = __DIR__ . DIRECTORY_SEPARATOR . "database.json";
$written = @file_put_contents($path, $raw, LOCK_EX);
if ($written === false) {
  http_response_code(500);
  echo json_encode(array("ok" => false, "message" => "Could not write database.json. In File Manager set that file to permission 644."));
  exit;
}

echo json_encode(array("ok" => true));
