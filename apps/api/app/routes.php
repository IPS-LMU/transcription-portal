<?php

declare(strict_types=1);

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Psr7\Utils;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Psr7\UploadedFile;

include_once(__DIR__ . "/../config.php");
include_once(__DIR__ . "/../functions.php");

$lstClient = new Client([
  // Base URI is used with relative requests
  'base_uri' => SUMMARIZATION_HOST,
  // You can set any number of default request options.
  'timeout' => 2.0,
  "auth" => [SUMMARIZATION_USER, SUMMARIZATION_PASSWORD]
]);

return function (App $app) {
  /***
   * SUMMARIZATION LST ---------------------- START --------------------------------
   */

  /**
   * creates a new project for summarization.
   * body: {
   *   projectName: string
   * }
   */
  $app->post('/summarization/lst/project/create', function (Request $request, Response $response) {
    global $lstClient;

    $parsedBody = $request->getParsedBody();
    $result = $lstClient->put('sumservice/' . $parsedBody['projectName']);

    $response = $response->withHeader('Content-Type', 'application/json');
    $response = $response->withStatus($result->getStatusCode());

    if ($result->getStatusCode() === 201) {
      $response->getBody()->write(json_encode(array("status" => "success")));
    } else {
      $response = $response->withStatus($result->getStatusCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $result->getBody()->getContents())));
    }

    return $response;
  });

  /**
   * deletes a summarization project with a given name.
   * body: {
   *   projectName: string
   * }
   */
  $app->delete('/summarization/lst/project', function (Request $request, Response $response) {
    global $lstClient;

    $parsedBody = $request->getParsedBody();
    $response = $response->withHeader('Content-Type', 'application/json');
    try {
      $result = $lstClient->delete('sumservice/' . $parsedBody['projectName']);

      $response = $response->withStatus($result->getStatusCode());
      $response->getBody()->write(json_encode(array("status" => "success")));
    } catch (GuzzleException $err) {
      $response = $response->withStatus($err->getCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $err->getMessage())));
    }
    return $response;
  });

  /**
   * uploads a file to an existing project.
   * body: {
   *   projectName: string;
   *   contents?: string;
   * }
   */
  $app->post('/summarization/lst/project/upload', function (Request $request, Response $response) {
    global $lstClient;
    $directory = $this->get('upload_directory');
    $uploadedFiles = $request->getUploadedFiles();
    $data = $request->getParsedBody();

    try {
      $file = $uploadedFiles['file'];
      if ($file->getError() === UPLOAD_ERR_OK) {
        $filename = moveUploadedFile($directory, $file);
        $newFilePath = $directory . DIRECTORY_SEPARATOR . $filename;
        $basename = pathinfo($file->getClientFilename(), PATHINFO_FILENAME);
        $file = null;
        $summarizationResponse = $lstClient->post("sumservice/" . $data["projectName"] . "/input/" . $basename . ".txt", [
          'multipart' => [
            [
              'name' => 'file',
              'contents' => Utils::streamFor(fopen($newFilePath, 'r')),
              'filename' => $basename . ".txt"
            ],
            [
              "name" => "inputtemplate",
              "contents" => "InputTextfile"
            ]
          ]
        ]);


        if (!empty($newFilePath)) {
          unlink($newFilePath);
        }
        if (!empty($file)) {
          unlink($file->getFilePath());
        }
        $response->getBody()->write(json_encode(array("status" => "success")));
      }
    } catch (GuzzleException $err) {
      $response = $response->withStatus($err->getCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $err->getMessage())));

      if (!empty($newFilePath)) {
        unlink($newFilePath);
      }
      if (!empty($file)) {
        unlink($file->getFilePath());
      }
    }

    return $response;
  });


  /**
   * process a given project
   * body: {
   *   projectName: string;
   *   language: string;
   *   words?: string;
   * }
   */
  $app->post('/summarization/lst/project/process', function (Request $request, Response $response) {
    global $lstClient;

    try {
      $parsedBody = $request->getParsedBody();
      $result = $lstClient->post('sumservice/' . $parsedBody['projectName'], [
        'form_params' => [
          'words' => !empty($parsedBody['words']) ? $parsedBody['words'] : null,
          'language' => $parsedBody['language']
        ]
      ]);

      $response = $response->withHeader('Content-Type', 'application/json');
      $response = $response->withStatus($result->getStatusCode());

      $xml = simplexml_load_string($result->getBody()->getContents());
      if ($xml === false) {
        $response = $response->withStatus(500);
        $response->getBody()->write(json_encode(array("status" => "failed", "message" => "Unable to read XML response from summarization service.")));
        return $response;
      }

      $response->getBody()->write(json_encode(array("status" => "success")));
    } catch (GuzzleException $err) {
      $response = $response->withStatus($err->getCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $err->getMessage())));
    }
    return $response;
  });

  /**
   * retrieves the status for a given project.
   * queryParams: {
   *   projectName: string;
   * }
   */
  $app->get('/summarization/lst/project', function (Request $request, Response $response) {
    global $lstClient;
    try {
      $queryParams = $request->getQueryParams();
      $result = $lstClient->get('sumservice/' . $queryParams['projectName']);

      $response = $response->withHeader('Content-Type', 'application/json');
      $response = $response->withStatus($result->getStatusCode());

      $xml = simplexml_load_string($result->getBody()->getContents());
      if ($xml === false) {
        $response = $response->withStatus(500);
        $response->getBody()->write(json_encode(array("status" => "failed", "message" => "Unable to read XML response from summarization service.")));
        return $response;
      }

      $progress = (int)$xml->status->attributes()->completion;
      $errors = (string)$xml->status->attributes()->errors;
      $errormsg = (string)$xml->status->attributes()->errormsg;

      $status = "";
      if ((string)$xml->status->attributes()->code == 0) {
        $status = "waiting";
      } else if ((string)$xml->status->attributes()->code == 1) {
        $status = "running";
      } else if ((string)$xml->status->attributes()->code == 2) {
        $status = "finished";
      }

      $inputs = array();
      if (!empty($xml->input->file) && $xml->input->file->count() > 1) {
        foreach ($xml->input->file as $input) {
          $inputs[] = array(
            "filename" => (string)$input->name,
            "template" => (string)$input->attributes()->template,
            "url" => SERVER_URL ."summarization/lst/project/file?path=". urlencode($queryParams['projectName'] ."/output/" . ((string)$input->name))
          );
        }
      } else if (!empty($xml->input->file)) {
        $inputs[] = array(
          "filename" => (string)$xml->input->file->name,
          "template" => (string)$xml->input->file->attributes()->template,
          "url" => SERVER_URL ."summarization/lst/project/file?path=". urlencode($queryParams['projectName'] ."/output/" . ((string)$xml->input->file->name))
        );
      }

      $outputs = array();
      if (!empty($xml->output->file) && $xml->output->file->count() > 1) {
        foreach ($xml->output->file as $output) {
          $outputs[] = array(
            "filename" => (string)$output->name,
            "template" => (string)$output->attributes()->template,
            "url" => SERVER_URL ."summarization/lst/project/file?path=". urlencode($queryParams['projectName'] ."/output/" . ((string)$output->name))
          );
        }
      } else if (!empty($xml->output->file)) {
        $outputs[] = array(
          "filename" => (string)$xml->output->file->name,
          "template" => (string)$xml->output->file->attributes()->template,
          "url" => SERVER_URL ."summarization/lst/project/file?path=". urlencode($queryParams['projectName'] ."/output/" . ((string)$xml->output->file->name))
        );
      }

      $response->getBody()->write(json_encode(array("status" => "success", "body" => array(
        "status" => $status,
        "progress" => $progress,
        "errors" => !($errors === "no"),
        "errorMessage" => !($errors === "no") ? $errormsg : null,
        "inputs" => $inputs,
        "outputs" => $outputs
      ))));
    } catch (GuzzleException $err) {
      $response = $response->withStatus($err->getCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $err->getMessage())));
    }
    return $response;
  });

  /**
   * retrieves a file.
   * queryParams: {
   *   projectName: string;
   * }
   */
  $app->get('/summarization/lst/project/file', function (Request $request, Response $response) {
    global $lstClient;
    $queryParams = $request->getQueryParams();
    $result = $lstClient->get('sumservice/' . $queryParams['path']);

    $response = $response->withHeader('Content-Type', $result->getHeader("Content-Type")[0]);;
    $response = $response->withStatus($result->getStatusCode());
    $response->getBody()->write($result->getBody()->getContents());
    return $response;
  });
  /***
   * SUMMARIZATION LST ---------------------- END --------------------------------
   */


  /***
   * ASR LST ---------------------- START --------------------------------
   */

  /**
   * creates a new project for asr.
   * body: {
   *   projectName: string
   * }
   */
  $app->post('/asr/lst/project/create', function (Request $request, Response $response) {
    global $lstClient;

    $parsedBody = $request->getParsedBody();
    $result = $lstClient->put('asrservice/' . $parsedBody['projectName']);

    $response = $response->withHeader('Content-Type', 'application/json');
    $response = $response->withStatus($result->getStatusCode());

    if ($result->getStatusCode() === 201) {
      $response->getBody()->write(json_encode(array("status" => "success")));
    } else {
      $response = $response->withStatus($result->getStatusCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $result->getBody()->getContents())));
    }

    return $response;
  });


  /**
   * deletes a asr project with a given name.
   * body: {
   *   projectName: string
   * }
   */
  $app->delete('/asr/lst/project', function (Request $request, Response $response) {
    global $lstClient;

    $parsedBody = $request->getParsedBody();
    $response = $response->withHeader('Content-Type', 'application/json');
    try {
      $result = $lstClient->delete('asrservice/' . $parsedBody['projectName']);

      $response = $response->withStatus($result->getStatusCode());
      $response->getBody()->write(json_encode(array("status" => "success")));
    } catch (GuzzleException $err) {
      $response = $response->withStatus($err->getCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $err->getMessage())));
    }
    return $response;
  });

  /**
   * uploads a file to an existing project.
   * body: {
   *   projectName: string;
   *   file: blob;
   * }
   */
  $app->post('/asr/lst/project/upload', function (Request $request, Response $response) {
    global $lstClient;
    $directory = $this->get('upload_directory');
    $uploadedFiles = $request->getUploadedFiles();
    $data = $request->getParsedBody();
    $newFilePath = null;

    try {
      $file = !empty($uploadedFiles) ? $uploadedFiles['file'] : null;
      $noError = empty($file) || $file->getError() === UPLOAD_ERR_OK;
      if ($noError) {
        $multipart = [
          [
            "name" => "inputtemplate",
            "contents" => "InputWavFile"
          ],
        ];

        $basename = "";
        if (!empty($file)) {
          $filename = moveUploadedFile($directory, $file);
          $newFilePath = $directory . DIRECTORY_SEPARATOR . $filename;

          $basename = pathinfo($file->getClientFilename(), PATHINFO_FILENAME);

          $file = null;
          $multipart[] = [
            'name' => 'file',
            'contents' => Utils::streamFor(fopen($newFilePath, 'r')),
            'filename' => $basename . ".wav"
          ];
        } else if (!empty($data["url"])) {
          $multipart[] = [
            "name" => "url",
            "contents" => $data["url"]
          ];
          $basename = $data["basename"];
        }

        $asrResponse = $lstClient->request("POST", "asrservice/" . $data["projectName"] . "/input/" . $basename . ".wav", [
          'allow_redirects' => true,
          'multipart' => $multipart
        ]);

        if (!empty($newFilePath)) {
          unlink($newFilePath);
        }
        if (!empty($file)) {
          unlink($file->getFilePath());
        }
        $response->withStatus($asrResponse->getStatusCode())->getBody()->write(json_encode(array("status" => "success")));
      }
    } catch (GuzzleException $err) {
      $response = $response->withStatus($err->getCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $err->getMessage())));

      if (!empty($newFilePath)) {
        unlink($newFilePath);
      }
      if (!empty($file)) {
        unlink($file->getFilePath());
      }
    }

    return $response;
  });


  /**
   * process a given project
   * body: {
   *   projectName: string;
   *   language: string;
   *   diarization?: boolean;
   *   minspeakers?: boolean;
   *   maxspeakers?: boolean;
   * }
   */
  $app->post('/asr/lst/project/process', function (Request $request, Response $response) {
    global $lstClient;

    try {
      $parsedBody = $request->getParsedBody();
      $result = $lstClient->post('asrservice/' . $parsedBody['projectName'], [
        'form_params' => [
          'diarization' => !empty($parsedBody['diarization']) ? $parsedBody['diarization'] : false,
          'minspeakers' => !empty($parsedBody['minspeakers']) ? $parsedBody['minspeakers'] : null,
          'maxspeakers' => !empty($parsedBody['maxspeakers']) ? $parsedBody['maxspeakers'] : null,
          'gpu' => !empty($parsedBody['gpu']) ? $parsedBody['gpu'] : false,
          'language' => $parsedBody['language'],
          "model" => "large-v3"
        ]
      ]);

      $response = $response->withHeader('Content-Type', 'application/json');
      $response = $response->withStatus($result->getStatusCode());

      $xml = simplexml_load_string($result->getBody()->getContents());
      if ($xml === false) {
        $response = $response->withStatus(500);
        $response->getBody()->write(json_encode(array("status" => "failed", "message" => "Unable to read XML response from summarization service.")));
        return $response;
      }

      $response->getBody()->write(json_encode(array("status" => "success")));
    } catch (GuzzleException $err) {
      $response = $response->withStatus($err->getCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $err->getMessage())));
    }
    return $response;
  });

  /**
   * retrieves the status for a given project.
   * queryParams: {
   *   projectName: string;
   * }
   */
  $app->get('/asr/lst/project', function (Request $request, Response $response) {
    global $lstClient;
    try {
      $queryParams = $request->getQueryParams();
      $result = $lstClient->get('asrservice/' . $queryParams['projectName']);

      $response = $response->withHeader('Content-Type', 'application/json');
      $response = $response->withStatus($result->getStatusCode());

      $xml = simplexml_load_string($result->getBody()->getContents());
      if ($xml === false) {
        $response = $response->withStatus(500);
        $response->getBody()->write(json_encode(array("status" => "failed", "message" => "Unable to read XML response from summarization service.")));
        return $response;
      }

      $progress = (int)$xml->status->attributes()->completion;
      $errors = (string)$xml->status->attributes()->errors;
      $errormsg = (string)$xml->status->attributes()->errormsg;

      $status = "";
      if ((string)$xml->status->attributes()->code == 0) {
        $status = "waiting";
      } else if ((string)$xml->status->attributes()->code == 1) {
        $status = "running";
      } else if ((string)$xml->status->attributes()->code == 2) {
        $status = "finished";
      }

      $inputs = array();
      if (!empty($xml->input->file) && $xml->input->file->count() > 1) {
        foreach ($xml->input->file as $input) {
          $inputs[] = array(
            "filename" => (string)$input->name,
            "template" => (string)$input->attributes()->template,
            "url" => SERVER_URL ."asr/lst/project/file?path=". urlencode($queryParams['projectName'] ."/output/" . ((string)$input->name))
          );
        }
      } else if (!empty($xml->input->file)) {
        $inputs[] = array(
          "filename" => (string)$xml->input->file->name,
          "template" => (string)$xml->input->file->attributes()->template,
          "url" => SERVER_URL ."asr/lst/project/file?path=". urlencode($queryParams['projectName'] ."/output/" . ((string)$xml->input->file->name))
        );
      }

      $outputs = array();
      if (!empty($xml->output->file) && $xml->output->file->count() > 1) {
        foreach ($xml->output->file as $output) {
          $outputs[] = array(
            "filename" => (string)$output->name,
            "template" => (string)$output->attributes()->template,
            "url" => SERVER_URL ."asr/lst/project/file?path=". urlencode($queryParams['projectName'] ."/output/" . ((string)$output->name))
          );
        }
      } else if (!empty($xml->output->file)) {
        $outputs[] = array(
          "filename" => (string)$xml->output->file->name,
          "template" => (string)$xml->output->file->attributes()->template,
          "url" => SERVER_URL ."asr/lst/project/file?path=". urlencode($queryParams['projectName'] ."/output/" . ((string)$xml->output->file->name))
        );
      }

      $response->getBody()->write(json_encode(array("status" => "success", "body" => array(
        "status" => $status,
        "progress" => $progress,
        "errors" => !($errors === "no"),
        "errorMessage" => !($errors === "no") ? $errormsg : null,
        "inputs" => $inputs,
        "outputs" => $outputs
      ))));
    } catch (GuzzleException $err) {
      $response = $response->withStatus($err->getCode());
      $response->getBody()->write(json_encode(array("status" => "failed", "message" => $err->getMessage())));
    }
    return $response;
  });

  /**
   * retrieves a file.
   * queryParams: {
   *   projectName: string;
   * }
   */
  $app->get('/asr/lst/project/file', function (Request $request, Response $response) {
    global $lstClient;
    $queryParams = $request->getQueryParams();
    $result = $lstClient->get('asrservice/' . $queryParams['path']);

    $response = $response->withHeader('Content-Type', $result->getHeader("Content-Type")[0]);;
    $response = $response->withStatus($result->getStatusCode());
    $response->getBody()->write($result->getBody()->getContents());
    return $response;
  });

  /***
   * ASR LST ---------------------- END --------------------------------
   */
};

/**
 * Moves the uploaded file to the upload directory and assigns it a unique name
 * to avoid overwriting an existing uploaded file.
 *
 * @param string $directory The directory to which the file is moved
 * @param UploadedFile $uploadedFile The file uploaded file to move
 *
 * @return string The filename of moved file
 */
function moveUploadedFile(string $directory, UploadedFile $uploadedFile)
{
  $extension = pathinfo($uploadedFile->getClientFilename(), PATHINFO_EXTENSION);
  // see http://php.net/manual/en/function.random-bytes.php
  $basename = bin2hex(random_bytes(8));
  $filename = sprintf('%s.%0.8s', $basename, $extension);

  $uploadedFile->moveTo($directory . DIRECTORY_SEPARATOR . $filename);

  return $filename;
}
