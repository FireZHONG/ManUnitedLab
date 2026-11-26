import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from app import agent, data_source, secrets, storage, sync, vision
from app.analysis import summarize

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / 'static'
PORT = int(os.environ.get('FC_PORT', '8765'))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def allowed(self):
        host = self.headers.get('Host', '').lower()
        if host not in (f'localhost:{PORT}', f'127.0.0.1:{PORT}'):
            return False
        origin = self.headers.get('Origin')
        if origin and origin not in (f'http://localhost:{PORT}', f'http://127.0.0.1:{PORT}'):
            return False
        return True

    def respond(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.allowed():
            return self.respond(403, {'error': '访问来源无效。'})
        parsed = urlparse(self.path)
        if parsed.path == '/api/squad':
            return self.respond(200, storage.get_squad())
        if parsed.path == '/api/players':
            query = parse_qs(parsed.query).get('q', [''])[0][:100]
            return self.respond(200, {'players': storage.search_players(query)})
        if parsed.path == '/api/player-search':
            query = parse_qs(parsed.query).get('q', [''])[0]
            try:
                return self.respond(200, data_source.search_players(query))
            except ValueError as exc:
                return self.respond(400, {'error': str(exc)})
        if parsed.path == '/api/player-detail':
            identifier = parse_qs(parsed.query).get('id', [''])[0]
            try:
                return self.respond(200, {'player': data_source.fetch_player(identifier)})
            except ValueError as exc:
                return self.respond(400, {'error': str(exc)})
        if parsed.path == '/api/config':
            return self.respond(200, agent.configuration_status())
        if parsed.path == '/api/secrets':
            return self.respond(200, {provider: secrets.status(provider) for provider in secrets.PROVIDERS})
        if parsed.path == '/api/sync':
            try:
                return self.respond(200, sync.status())
            except ValueError as exc:
                return self.respond(400, {'error': str(exc)})
        files = {'/': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css'}
        if parsed.path not in files:
            return self.respond(404, {'error': '页面不存在。'})
        file = STATIC / files[parsed.path]
        content = file.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', (mimetypes.guess_type(file.name)[0] or 'text/plain') + '; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https://s1.fifaaddict.com https://fifaaddict.com; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        if not self.allowed():
            return self.respond(403, {'error': '访问来源无效。'})
        if not self.headers.get('Content-Type', '').lower().startswith('application/json'):
            return self.respond(415, {'error': '请求格式无效。'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 6 * 1024 * 1024:
                raise ValueError('请求内容为空或过大。')
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            if not isinstance(body, dict):
                raise ValueError('请求格式无效。')
            path = urlparse(self.path).path
            if path in ('/api/secrets', '/api/sync/export', '/api/sync/import'):
                if self.headers.get('Origin') != 'http://' + self.headers.get('Host', '').lower():
                    return self.respond(403, {'error': '设置操作需要本机同源页面。'})
            if path == '/api/secrets':
                provider = body.get('provider')
                if body.get('action') == 'save':
                    result = secrets.save(provider, body.get('key'))
                elif body.get('action') == 'delete':
                    result = secrets.delete(provider)
                else:
                    raise ValueError('无效的密钥操作。')
            elif path == '/api/sync/export':
                result = sync.export(body.get('file_hash'), body.get('data_hash'), body.get('force') is True)
            elif path == '/api/sync/import':
                result = sync.import_snapshot(body.get('file_hash'), body.get('data_hash'))
            elif path == '/api/player':
                value = body.get('url', '')
                if not isinstance(value, str):
                    raise ValueError('请输入球员详情链接。')
                identifier = data_source.player_id(value)
                try:
                    player = storage.save_player(data_source.fetch_player(identifier))
                    result = {'player': player, 'stale': False}
                except ValueError:
                    player = storage.get_player(identifier)
                    if not player:
                        raise
                    result = {'player': player, 'stale': True, 'warning': '刷新失败，当前显示的是本地缓存，请核对抓取时间。'}
            elif path == '/api/squad':
                result = storage.save_squad(body)
            elif path == '/api/vision':
                result = {'players': vision.recognize(body.get('image'), body.get('mode', 'local'))}
            elif path == '/api/chat':
                result = {'reply': agent.chat(summarize(storage.get_squad()), body.get('messages'), body.get('mode', 'local'))}
            else:
                return self.respond(404, {'error': '接口不存在。'})
            return self.respond(200, result)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            return self.respond(400, {'error': str(exc) or '请求数据无效。'})
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception:
            return self.respond(500, {'error': '本地服务发生错误，请重试。'})


if __name__ == '__main__':
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
        print(f'FC Online 助手已启动：http://127.0.0.1:{PORT}', flush=True)
        print('按 Ctrl+C 停止服务。', flush=True)
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务已停止。')
    except OSError as exc:
        print(f'服务启动失败：{exc}', file=sys.stderr)
        sys.exit(1)
