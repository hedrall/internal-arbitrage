<?php
    /**
     * アクセストークンコントローラ
     * @author motoki.okamoto
     */
    class Controller_Api_Zaif extends Controller
    {
        public function get_index ( $api = null, $currency_pair = 'all' ) {
            try {
                $result = file_get_contents('https://api.zaif.jp/api/1/' . $api . '/' . $currency_pair);
            }
            catch ( \Exception $e) {
                $response = new Response( 'error', 500 );
                $response->set_header('Access-Control-Allow-Origin', '*');
                $response->set_header('Content-Type', 'application/json; charset=utf-8');
                return $response;
            }
            $response = new Response( $result );
            $response->set_header('Access-Control-Allow-Origin', '*');
            $response->set_header('Content-Type', 'application/json; charset=utf-8');
            return $response;
        }

        public function post_index ( $api = null ) {
            $key = "{{ YOUR_API_KEY }}";
            $secret = "{{ YOUR_SECRET_KEY }}";
            $url = "https://api.zaif.jp/tapi";

            $nonce = $result = \Db::insert('nonce')
                ->set(['dust' => 'a'])
                ->execute('coin_writer')[0];

            // POSTデータ
            $data = array(
                'method' => $api,
                'nonce' => $nonce
            );
            if ($_POST) {
                $data = array_merge($_POST, $data);
            }
            $sign = hash_hmac('sha512', http_build_query($data), $secret); // パラメータをsha512で暗号化


            $data = http_build_query($data, "", "&");

            // header
            $header = array(
                "Content-Type: application/x-www-form-urlencoded",
                "Content-Length: ".strlen($data),
                "key: ".$key,
                "sign: ".$sign
            );

            $context = array(
                "http" => array(
                    "method"  => "POST",
                    "header"  => implode("\r\n", $header),
                    "content" => $data
                )
            );

            try {
                $response = file_get_contents($url, false, stream_context_create($context));
            }
            catch (\Exception $e) {
                $response = new Response( 'error', 500 );
                $response->set_header('Access-Control-Allow-Origin', '*');
                $response->set_header('Content-Type', 'application/json; charset=utf-8');
                return $response;
            }
            $response = new Response( $response );
            $response->set_header('Access-Control-Allow-Origin', '*');
            $response->set_header('Content-Type', 'application/json; charset=utf-8');
            return $response;
        }

        public function action_test() {
            phpinfo();
            var_dump('a');exit;
        }
    }
