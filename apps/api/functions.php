<?php

function post($url, $data = null, $credentials = null, $additionalHeaders = array()): bool|string
{
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge(array('Content-Type: application/json'), $additionalHeaders));
  curl_setopt($ch, CURLOPT_HEADER, 1);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  curl_setopt($ch, CURLOPT_POST, 1);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

  if (isset($data)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
  }

  if (isset($credentials)) {
    curl_setopt($ch, CURLOPT_USERPWD, $credentials["user"] . ":" . $credentials["password"]);
  }

  $response = curl_exec($ch);

  if ($response === false) {
    die('Error occurred while fetching the data: '
      . curl_error($ch));
  }

  // Close cURL session
  curl_close($ch);

  // Display the response
  return $response;
}


function put($client, $data = null, $credentials = null, $additionalHeaders = array()): bool|string
{


  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge(array('Content-Type: text/plain'), $additionalHeaders));
  curl_setopt($ch, CURLOPT_HEADER, 1);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  curl_setopt($ch, CURLOPT_PUT, 1);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

  if (isset($data)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
  }

  if (isset($credentials)) {
    curl_setopt($ch, CURLOPT_USERPWD, $credentials["user"] . ":" . $credentials["password"]);
  }

  $response = curl_exec($ch);

  if ($response === false) {
    curl_close($ch);
    throw new Exception(curl_error($ch));
  }

  // Close cURL session
  curl_close($ch);

  // Display the response
  return $response;
}
