import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

from app import data_source, storage

SYNC_DIR = storage.ROOT / 'sync'
SNAPSHOT = SYNC_DIR / 'snapshot.json'
MAX_SIZE = 20 * 1024 * 1024
PLAYER_FIELDS = ('id', 'name', 'season', 'ovr', 'position', 'club', 'height_cm', 'weight_kg', 'weak_foot', 'attributes', 'attributes_note', 'traits', 'description', 'source_url', 'fetched_at', 'data_note')
SQUAD_FIELDS = ('name', 'formation', 'mode', 'notes')
SLOT_FIELDS = ('key', 'position', 'name', 'season', 'level', 'player_id')


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def digest(value):
    return hashlib.sha256(value).hexdigest()


def file_bytes():
    try:
        with SNAPSHOT.open('rb') as source:
            value = source.read(MAX_SIZE + 1)
    except FileNotFoundError:
        return None
    if len(value) > MAX_SIZE:
        raise ValueError('同步文件过大，请先检查文件。')
    return value


def data_from(connection):
    row = connection.execute('SELECT value FROM settings WHERE key = ?', ('squad',)).fetchone()
    squad = json.loads(row[0]) if row else storage.default_squad()
    players = [json.loads(row[0]) for row in connection.execute('SELECT data FROM players ORDER BY id')]
    squad = {key: squad.get(key, '') for key in SQUAD_FIELDS} | {'slots': [{key: slot[key] for key in SLOT_FIELDS if key in slot} for slot in squad['slots']]}
    players = [{key: player[key] for key in PLAYER_FIELDS if key in player} for player in players]
    return {'version': 1, 'squad': squad, 'players': players}


def baseline_from(connection):
    row = connection.execute('SELECT value FROM settings WHERE key = ?', ('sync_baseline',)).fetchone()
    return json.loads(row[0]) if row else {}


def status():
    raw = file_bytes()
    file_hash = digest(raw) if raw is not None else None
    with storage.connect() as connection:
        data_hash = digest(encode(data_from(connection)))
        baseline = baseline_from(connection)
    return {'exists': raw is not None, 'file_hash': file_hash, 'data_hash': data_hash,
            'file_changed': raw is not None and file_hash != baseline.get('file_hash'),
            'data_changed': data_hash != baseline.get('data_hash'), 'has_baseline': bool(baseline)}


def validate(snapshot):
    if not isinstance(snapshot, dict) or set(snapshot) != {'version', 'squad', 'players'} or type(snapshot['version']) is not int or snapshot['version'] != 1:
        raise ValueError('同步文件版本或结构无效。')
    players = snapshot['players']
    if not isinstance(players, list) or len(players) > 20000:
        raise ValueError('同步文件中的球员数据无效。')
    identifiers = set()
    for player in players:
        if not isinstance(player, dict) or set(player) != set(PLAYER_FIELDS):
            raise ValueError('同步文件中的球员字段无效。')
        identifier = player['id']
        if not isinstance(identifier, str) or not re.fullmatch(r'[a-z0-9]{5,20}', identifier) or identifier in identifiers:
            raise ValueError('同步文件中的球员 ID 无效或重复。')
        identifiers.add(identifier)
        if not isinstance(player['source_url'], str) or player['source_url'] != f'{data_source.BASE_URL}/fo4db/pid{identifier}':
            raise ValueError('同步文件中的球员来源链接无效。')
        for field in ('name', 'season', 'position', 'club', 'attributes_note', 'description', 'fetched_at', 'data_note'):
            if not isinstance(player[field], str) or len(player[field]) > 10000:
                raise ValueError('同步文件中的球员文本无效。')
        if not player['name'] or not player['season']:
            raise ValueError('同步文件中的球员名称或赛季为空。')
        if type(player['ovr']) is not int or not 0 <= player['ovr'] <= 1000:
            raise ValueError('同步文件中的球员总评无效。')
        for field in ('height_cm', 'weight_kg', 'weak_foot'):
            if player[field] is not None and (type(player[field]) is not int or not 0 <= player[field] <= 1000):
                raise ValueError('同步文件中的球员数值无效。')
        attributes, traits = player['attributes'], player['traits']
        if not isinstance(attributes, dict) or len(attributes) > 200 or any(not isinstance(key, str) or len(key) > 100 or type(value) is not int or not 0 <= value <= 1000 for key, value in attributes.items()):
            raise ValueError('同步文件中的球员属性无效。')
        if not isinstance(traits, list) or len(traits) > 200 or any(not isinstance(value, str) or len(value) > 200 for value in traits):
            raise ValueError('同步文件中的球员特性无效。')
    squad = snapshot['squad']
    if not isinstance(squad, dict) or set(squad) != set(SQUAD_FIELDS) | {'slots'} or not isinstance(squad.get('slots'), list):
        raise ValueError('同步文件中的阵容格式无效。')
    if any(not isinstance(slot, dict) or not set(slot).issubset(SLOT_FIELDS) or not {'key', 'position'}.issubset(slot) for slot in squad['slots']):
        raise ValueError('同步文件中的阵容位置无效。')
    storage.validate_squad(squad, identifiers)
    return snapshot


def record_baseline(connection, file_hash, data_hash):
    value = json.dumps({'file_hash': file_hash, 'data_hash': data_hash})
    connection.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ('sync_baseline', value))


def export(expected_file_hash, expected_data_hash, force=False):
    with storage.connect() as connection:
        connection.execute('BEGIN IMMEDIATE')
        raw = file_bytes()
        current_file_hash = digest(raw) if raw is not None else None
        value = data_from(connection)
        validate(value)
        encoded = encode(value)
        current_data_hash = digest(encoded)
        if current_file_hash != expected_file_hash or current_data_hash != expected_data_hash:
            raise ValueError('同步状态已变化，请刷新状态后重试。')
        baseline = baseline_from(connection)
        if raw is not None and current_file_hash != baseline.get('file_hash'):
            try:
                json.loads(raw.decode('utf-8'))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ValueError('同步文件不是有效 JSON，可能存在未解决的 Git 冲突，请先处理。') from exc
            if not force:
                raise ValueError('同步文件包含尚未导入的变更，请先导入或确认覆盖。')
        if len(encoded) > MAX_SIZE:
            raise ValueError('同步数据过大，无法导出。')
        SYNC_DIR.mkdir(exist_ok=True)
        name = None
        try:
            with tempfile.NamedTemporaryFile(dir=SYNC_DIR, prefix='.snapshot-', suffix='.tmp', delete=False) as target:
                name = target.name
                target.write(encoded)
                target.flush()
                os.fsync(target.fileno())
            os.replace(name, SNAPSHOT)
            name = None
        finally:
            if name is not None and Path(name).exists():
                Path(name).unlink()
        record_baseline(connection, digest(encoded), current_data_hash)
    return status()


def import_snapshot(expected_file_hash, expected_data_hash):
    raw = file_bytes()
    if raw is None:
        raise ValueError('没有同步文件，请先从 Git 拉取或在其他设备导出。')
    if digest(raw) != expected_file_hash:
        raise ValueError('同步文件已变化，请刷新状态后重试。')
    try:
        value = validate(json.loads(raw.decode('utf-8')))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError('同步文件不是有效 JSON，可能存在未解决的 Git 冲突。') from exc
    with storage.connect() as connection:
        connection.execute('BEGIN IMMEDIATE')
        if digest(encode(data_from(connection))) != expected_data_hash:
            raise ValueError('本机数据已变化，请刷新状态后重试。')
        latest = file_bytes()
        if latest is None or digest(latest) != expected_file_hash:
            raise ValueError('同步文件已变化，请刷新状态后重试。')
        connection.execute('DELETE FROM players')
        connection.executemany('INSERT INTO players (id, data) VALUES (?, ?)', [(player['id'], json.dumps(player, ensure_ascii=False)) for player in value['players']])
        connection.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ('squad', json.dumps(value['squad'], ensure_ascii=False)))
        record_baseline(connection, digest(raw), digest(encode(data_from(connection))))
    return status()
